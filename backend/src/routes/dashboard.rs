use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

use crate::auth::Session;
use crate::error::AppResult;
use crate::rbac::{authorize, AuthorizeOptions};
use crate::routes::{documents, exams, fees, risk, students, timetable};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/dashboard/student", get(student_dashboard))
}

async fn student_dashboard(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "profile.view", None, AuthorizeOptions::default()).await?;
    let pool = &state.pool;

    let profile = students::student_profile(pool, &ctx, None).await?;
    let student_id = profile.id;

    let attendance = attendance_summary_json(pool, &ctx, student_id).await?;
    let timetable_rows = timetable::student_timetable(pool, &ctx, Some(student_id)).await?;
    let fee_status = fees::fee_status(pool, &ctx, Some(student_id)).await?;
    let doc_list = documents::list_documents(pool, &ctx, Some(student_id)).await?;
    let exam_schedule = exams::schedule_for(pool, &ctx, Some(student_id)).await?;
    let risk = risk::student_risk(pool, student_id).await?;
    let next_class = timetable::next_class(pool, &ctx, Some(student_id)).await?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let mut upcoming: Vec<&serde_json::Value> = exam_schedule.iter().filter(|e| e["date"].as_str().unwrap_or("") >= today.as_str()).collect();
    upcoming.sort_by_key(|e| e["date"].as_str().unwrap_or("").to_string());
    let upcoming: Vec<_> = upcoming.into_iter().take(3).collect();

    let recent_certificate = doc_list["certificates"]
        .as_array()
        .and_then(|certs| {
            let mut ready: Vec<_> = certs.iter().filter(|c| c["status"] == json!("ready")).collect();
            ready.sort_by(|a, b| b["issuedAt"].as_str().unwrap_or("").cmp(a["issuedAt"].as_str().unwrap_or("")));
            ready.first().cloned()
        })
        .cloned();

    Ok(Json(json!({
        "profile": profile,
        "attendance": attendance,
        "nextClass": next_class,
        "timetableCount": timetable_rows.len(),
        "fees": fee_status,
        "upcomingExams": upcoming,
        "recentCertificate": recent_certificate,
        "risk": risk,
    })))
}

async fn attendance_summary_json(pool: &sqlx::PgPool, ctx: &crate::rbac::AccessContext, student_id: i32) -> AppResult<serde_json::Value> {
    // Reuses the same aggregate the /api/attendance route serves, scoped to
    // an id we've already resolved, so it never re-authorizes against the
    // caller's own identity twice.
    crate::routes::attendance::summary_for(pool, ctx, student_id).await
}
