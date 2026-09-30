use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::{authorize, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/leave", get(mine).post(apply))
        .route("/api/admin/leave", get(queue))
        .route("/api/admin/leave/decide", post(decide))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplyBody {
    leave_type: String,
    from_date: String,
    to_date: String,
    reason: String,
}

async fn apply(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<ApplyBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "leave.apply", None, AuthorizeOptions::default()).await?;

    let row = sqlx::query!(
        r#"insert into leave_applications (applicant_user_id, applicant_role, leave_type, from_date, to_date, reason)
           values ($1, $2, $3, $4, $5, $6) returning id, applied_at"#,
        ctx.user_id,
        ctx.role,
        body.leave_type,
        body.from_date,
        body.to_date,
        body.reason
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({ "application": { "id": row.id, "status": "pending", "appliedAt": row.applied_at } })))
}

async fn mine(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let rows = sqlx::query!(
        "select * from leave_applications where applicant_user_id = $1 order by applied_at desc",
        ctx.user_id
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "leaveType": r.leave_type, "fromDate": r.from_date, "toDate": r.to_date, "reason": r.reason,
            "status": r.status, "appliedAt": r.applied_at, "decidedAt": r.decided_at, "remarks": r.remarks,
        }))
        .collect();

    Ok(Json(json!({ "applications": out })))
}

async fn queue(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "leave.manage", None, AuthorizeOptions::default()).await?;

    let rows = sqlx::query!(
        r#"
        select la.id, la.applicant_user_id, la.applicant_role, la.leave_type, la.from_date, la.to_date, la.reason,
               la.status, la.applied_at, la.decided_at, la.remarks, u.name as applicant_name
        from leave_applications la
        join users u on u.id = la.applicant_user_id
        order by la.applied_at desc
        limit 200
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "applicantUserId": r.applicant_user_id, "applicantName": r.applicant_name, "applicantRole": r.applicant_role,
            "leaveType": r.leave_type, "fromDate": r.from_date, "toDate": r.to_date, "reason": r.reason,
            "status": r.status, "appliedAt": r.applied_at, "decidedAt": r.decided_at, "remarks": r.remarks,
        }))
        .collect();

    Ok(Json(json!({ "applications": out })))
}

#[derive(Debug, Deserialize)]
struct DecideBody {
    #[serde(rename = "applicationId")]
    application_id: i32,
    decision: String,
    remarks: Option<String>,
}

async fn decide(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<DecideBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "leave.manage",
        None,
        AuthorizeOptions { resource_label: Some(&format!("leave_application:{}", body.application_id)), force_audit: true },
    )
    .await?;

    let result = sqlx::query!(
        "update leave_applications set status = $1, decided_at = now(), decided_by = $2, remarks = $3 where id = $4 and status = 'pending'",
        body.decision,
        ctx.user_id,
        body.remarks,
        body.application_id
    )
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::BadRequest("Application not found or already decided.".to_string()));
    }

    Ok(Json(json!({ "success": true })))
}
