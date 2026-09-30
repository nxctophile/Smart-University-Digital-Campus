use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::{authorize, resolve_student_id_for_access, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/profile/edit", get(current).post(submit))
        .route("/api/profile/verify-email", post(verify_email))
        .route("/api/admin/profile-requests", get(list_requests))
        .route("/api/admin/profile-requests/decide", post(decide))
}

async fn current(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "profile.update.request", None).await?;

    let student = sqlx::query!(
        "select father_name, mother_name, category, address, pincode, guardian_phone, email, email_verified, dob from students where id = $1",
        student_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Student not found.".to_string()))?;

    let pending = sqlx::query!(
        "select id, payload, document_ids, status, submitted_at from profile_edit_requests where student_id = $1 order by submitted_at desc limit 1",
        student_id
    )
    .fetch_optional(&state.pool)
    .await?;

    Ok(Json(json!({
        "current": {
            "fatherName": student.father_name, "motherName": student.mother_name, "category": student.category,
            "address": student.address, "pincode": student.pincode, "phone": student.guardian_phone,
            "email": student.email, "emailVerified": student.email_verified, "dob": student.dob,
        },
        "pendingRequest": pending.map(|p| json!({
            "id": p.id, "payload": p.payload, "documentIds": p.document_ids, "status": p.status, "submittedAt": p.submitted_at,
        })),
    })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitBody {
    father_name: Option<String>,
    mother_name: Option<String>,
    category: Option<String>,
    address: Option<String>,
    pincode: Option<String>,
    document_ids: Vec<i32>,
}

async fn submit(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<SubmitBody>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "profile.update.request", None).await?;

    let existing_pending = sqlx::query!(
        "select id from profile_edit_requests where student_id = $1 and status = 'pending'",
        student_id
    )
    .fetch_optional(&state.pool)
    .await?;
    if existing_pending.is_some() {
        return Err(AppError::BadRequest("You already have a profile update pending review.".to_string()));
    }

    let payload = json!({
        "fatherName": body.father_name, "motherName": body.mother_name, "category": body.category,
        "address": body.address, "pincode": body.pincode,
    });

    let row = sqlx::query!(
        r#"insert into profile_edit_requests (student_id, payload, document_ids) values ($1, $2, $3) returning id, submitted_at"#,
        student_id,
        payload,
        &body.document_ids
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({ "request": { "id": row.id, "status": "pending", "submittedAt": row.submitted_at } })))
}

#[derive(Debug, Deserialize)]
struct VerifyEmailBody {
    code: String,
}

async fn verify_email(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<VerifyEmailBody>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "profile.update.request", None).await?;
    // Demo mode - no SMTP is configured, so the "code" the UI displays is
    // always 000000. Any 6-digit input is accepted so the flow can still be
    // demoed end to end. See CLAUDE.md for the rest of the demo-mode list.
    if body.code.trim().len() != 6 {
        return Err(AppError::BadRequest("Enter the 6-digit code.".to_string()));
    }
    sqlx::query!("update students set email_verified = true where id = $1", student_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "success": true })))
}

async fn list_requests(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "profile.update.review", None, AuthorizeOptions::default()).await?;
    let rows = sqlx::query!(
        r#"
        select per.id, per.student_id, per.payload, per.document_ids, per.status, per.submitted_at, per.decided_at, per.remarks,
               s.roll_number, s.first_name, s.last_name
        from profile_edit_requests per
        join students s on s.id = per.student_id
        order by per.submitted_at desc
        limit 200
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "studentId": r.student_id, "rollNumber": r.roll_number, "firstName": r.first_name, "lastName": r.last_name,
            "payload": r.payload, "documentIds": r.document_ids, "status": r.status, "submittedAt": r.submitted_at,
            "decidedAt": r.decided_at, "remarks": r.remarks,
        }))
        .collect();

    Ok(Json(json!({ "requests": out })))
}

#[derive(Debug, Deserialize)]
struct DecideBody {
    #[serde(rename = "requestId")]
    request_id: i32,
    decision: String,
    remarks: Option<String>,
}

async fn decide(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<DecideBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "profile.update.review",
        None,
        AuthorizeOptions { resource_label: Some(&format!("profile_edit_request:{}", body.request_id)), force_audit: true },
    )
    .await?;

    let request = sqlx::query!("select student_id, payload, status from profile_edit_requests where id = $1", body.request_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Request not found.".to_string()))?;
    if request.status != "pending" {
        return Err(AppError::BadRequest("This request has already been decided.".to_string()));
    }

    if body.decision == "approved" {
        let payload = request.payload;
        sqlx::query!(
            r#"
            update students set
              father_name = coalesce($1, father_name),
              mother_name = coalesce($2, mother_name),
              category = coalesce($3, category),
              address = coalesce($4, address),
              pincode = coalesce($5, pincode),
              updated_at = now()
            where id = $6
            "#,
            payload["fatherName"].as_str(),
            payload["motherName"].as_str(),
            payload["category"].as_str(),
            payload["address"].as_str(),
            payload["pincode"].as_str(),
            request.student_id
        )
        .execute(&state.pool)
        .await?;
    }

    sqlx::query!(
        "update profile_edit_requests set status = $1, decided_at = now(), decided_by = $2, remarks = $3 where id = $4",
        body.decision,
        ctx.user_id,
        body.remarks,
        body.request_id
    )
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "success": true })))
}
