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
        .route("/api/exam-review", get(mine))
        .route("/api/exam-review/apply", post(apply))
        .route("/api/admin/exam-review", get(queue))
        .route("/api/admin/exam-review/decide", post(decide))
}

fn fee_for(kind: &str) -> f64 {
    match kind {
        "revaluation" => 300.0,
        "retotal" => 50.0,
        "challenge" => 100.0,
        _ => 0.0,
    }
}

async fn mine(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "exam.review.apply", None).await?;

    let eligible = sqlx::query!(
        r#"
        select er.exam_id, e.name as exam_name, e.max_marks, c.id as course_id, c.code as course_code, c.name as course_name, er.marks_obtained
        from exam_results er
        join exams e on e.id = er.exam_id
        join courses c on c.id = e.course_id
        where er.student_id = $1 and er.graded = true
        order by e.date desc
        "#,
        student_id
    )
    .fetch_all(&state.pool)
    .await?;

    let applications = sqlx::query!(
        r#"
        select era.id, era.exam_id, era.course_id, era.kind, era.fee_amount, era.status, era.applied_at, era.decided_at,
               era.remarks, era.parent_application_id, c.code as course_code, e.name as exam_name
        from exam_review_applications era
        join courses c on c.id = era.course_id
        join exams e on e.id = era.exam_id
        where era.student_id = $1
        order by era.applied_at desc
        "#,
        student_id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(json!({
        "eligibleResults": eligible.into_iter().map(|r| json!({
            "examId": r.exam_id, "examName": r.exam_name, "maxMarks": r.max_marks, "courseId": r.course_id,
            "courseCode": r.course_code, "courseName": r.course_name, "marksObtained": r.marks_obtained,
        })).collect::<Vec<_>>(),
        "applications": applications.into_iter().map(|a| json!({
            "id": a.id, "examId": a.exam_id, "examName": a.exam_name, "courseId": a.course_id, "courseCode": a.course_code,
            "kind": a.kind, "feeAmount": a.fee_amount, "status": a.status, "appliedAt": a.applied_at, "decidedAt": a.decided_at,
            "remarks": a.remarks, "parentApplicationId": a.parent_application_id,
        })).collect::<Vec<_>>(),
        "fees": { "revaluation": fee_for("revaluation"), "retotal": fee_for("retotal"), "challenge": fee_for("challenge") },
    })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplyBody {
    exam_id: i32,
    course_id: i32,
    kind: String,
    parent_application_id: Option<i32>,
}

async fn apply(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<ApplyBody>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "exam.review.apply", None).await?;

    if !["revaluation", "retotal", "challenge"].contains(&body.kind.as_str()) {
        return Err(AppError::BadRequest("Unknown application kind.".to_string()));
    }

    if body.kind == "challenge" {
        let parent_id = body.parent_application_id.ok_or_else(|| AppError::BadRequest("A challenge must reference its revaluation application.".to_string()))?;
        let parent = sqlx::query!(
            "select student_id, kind, status from exam_review_applications where id = $1",
            parent_id
        )
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Revaluation application not found.".to_string()))?;
        if parent.student_id != student_id || parent.kind != "revaluation" || parent.status != "completed" {
            return Err(AppError::BadRequest("Challenge requires a completed revaluation for this subject.".to_string()));
        }
    }

    sqlx::query!("select id from exams where id = $1", body.exam_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Exam not found.".to_string()))?;

    let fee = fee_for(&body.kind);
    let row = sqlx::query!(
        r#"insert into exam_review_applications (student_id, exam_id, course_id, kind, fee_amount, parent_application_id)
           values ($1, $2, $3, $4, $5, $6) returning id, applied_at"#,
        student_id,
        body.exam_id,
        body.course_id,
        body.kind,
        fee,
        body.parent_application_id
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({ "application": { "id": row.id, "status": "submitted", "appliedAt": row.applied_at, "feeAmount": fee } })))
}

async fn queue(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "exam.review.manage", None, AuthorizeOptions::default()).await?;
    let rows = sqlx::query!(
        r#"
        select era.id, era.exam_id, era.course_id, era.kind, era.fee_amount, era.status, era.applied_at, era.remarks,
               c.code as course_code, e.name as exam_name, s.roll_number, s.first_name, s.last_name
        from exam_review_applications era
        join courses c on c.id = era.course_id
        join exams e on e.id = era.exam_id
        join students s on s.id = era.student_id
        order by era.applied_at desc
        limit 200
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "examName": r.exam_name, "courseCode": r.course_code, "kind": r.kind, "feeAmount": r.fee_amount,
            "status": r.status, "appliedAt": r.applied_at, "remarks": r.remarks,
            "rollNumber": r.roll_number, "firstName": r.first_name, "lastName": r.last_name,
        }))
        .collect();

    Ok(Json(json!({ "applications": out })))
}

#[derive(Debug, Deserialize)]
struct DecideBody {
    #[serde(rename = "applicationId")]
    application_id: i32,
    status: String,
    remarks: Option<String>,
}

async fn decide(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<DecideBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "exam.review.manage",
        None,
        AuthorizeOptions { resource_label: Some(&format!("exam_review_application:{}", body.application_id)), force_audit: true },
    )
    .await?;

    if !["under_review", "approved", "rejected", "completed"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Unknown status.".to_string()));
    }

    sqlx::query!(
        "update exam_review_applications set status = $1, decided_at = now(), remarks = $2 where id = $3",
        body.status,
        body.remarks,
        body.application_id
    )
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "success": true })))
}
