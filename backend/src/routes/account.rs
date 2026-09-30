use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/account/password", post(change_password))
        .route("/api/account/password-history", get(history))
}

#[derive(Debug, Deserialize)]
struct ChangeBody {
    #[serde(rename = "newPassword")]
    new_password: String,
}

// This is a passwordless demo - there's no real credential to check against
// (see CLAUDE.md's "Login / session" section). This endpoint exists so the
// My Account UI has a real round trip to demonstrate against; it logs the
// "change" rather than actually rotating a credential.
async fn change_password(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<ChangeBody>) -> AppResult<Json<serde_json::Value>> {
    if body.new_password.trim().len() < 6 {
        return Err(AppError::BadRequest("Password must be at least 6 characters.".to_string()));
    }
    sqlx::query!(
        "insert into password_change_log (user_id, note) values ($1, 'Password changed via My Account')",
        ctx.user_id
    )
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({ "success": true })))
}

async fn history(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let rows = sqlx::query!(
        "select id, changed_at, note from password_change_log where user_id = $1 order by changed_at desc",
        ctx.user_id
    )
    .fetch_all(&state.pool)
    .await?;
    let out: Vec<_> = rows.into_iter().map(|r| json!({ "id": r.id, "changedAt": r.changed_at, "note": r.note })).collect();
    Ok(Json(json!({ "history": out })))
}
