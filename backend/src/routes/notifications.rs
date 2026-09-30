use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

use crate::auth::Session;
use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/notifications", get(list))
}

async fn list(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let rows = sqlx::query!(
        r#"select * from notifications where audience_role is null or audience_role = $1 order by created_at desc limit 12"#,
        ctx.role
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|n| json!({
            "id": n.id, "universityId": n.university_id, "audienceRole": n.audience_role, "studentId": n.student_id,
            "title": n.title, "message": n.message, "category": n.category, "createdAt": n.created_at, "readAt": n.read_at,
        }))
        .collect();

    Ok(Json(json!({ "notifications": out })))
}
