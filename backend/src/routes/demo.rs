use axum::extract::State;
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::auth::{load_context, Session};
use crate::config::COOKIE_NAME;
use crate::error::{AppError, AppResult};
use crate::rbac::audit::{record_audit, AuditEntry};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/demo/users", get(list_users))
        .route("/api/demo/session", post(login).delete(logout))
}

async fn list_users(State(state): State<AppState>) -> AppResult<Json<serde_json::Value>> {
    let users = sqlx::query!("select id, name, email, role from users order by id")
        .fetch_all(&state.pool)
        .await?;

    let assignments = sqlx::query!(
        r#"
        select ur.user_id, r.name as role_name
        from user_roles ur
        join roles r on r.id = ur.role_id
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = users
        .into_iter()
        .map(|u| {
            let role_names: Vec<&str> = assignments
                .iter()
                .filter(|a| a.user_id == u.id)
                .map(|a| a.role_name.as_str())
                .collect();
            json!({
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "roleNames": role_names,
            })
        })
        .collect();

    Ok(Json(json!({ "users": out })))
}

#[derive(Deserialize)]
struct LoginBody {
    #[serde(rename = "userId")]
    user_id: i32,
}

async fn login(State(state): State<AppState>, Json(body): Json<LoginBody>) -> AppResult<Response> {
    let user = sqlx::query!("select id, name, role from users where id = $1", body.user_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Unknown demo user.".to_string()))?;

    let ctx = load_context(&state.pool, user.id).await?;

    record_audit(
        &state.pool,
        AuditEntry {
            user_id: Some(user.id),
            user_name: &user.name,
            user_role: &user.role,
            action: "auth.login",
            resource: None,
            result: "success",
        },
    )
    .await?;

    let cookie = format!("{COOKIE_NAME}={}; Path=/; SameSite=Lax", user.id);
    let mut response = Json(ctx.to_client()).into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, HeaderValue::from_str(&cookie).unwrap());
    Ok(response)
}

async fn logout(State(state): State<AppState>, session: Option<Session>) -> AppResult<Response> {
    if let Some(Session(ctx)) = session {
        record_audit(
            &state.pool,
            AuditEntry {
                user_id: Some(ctx.user_id),
                user_name: &ctx.name,
                user_role: &ctx.role,
                action: "auth.logout",
                resource: None,
                result: "success",
            },
        )
        .await?;
    }

    let cookie = format!("{COOKIE_NAME}=; Path=/; Max-Age=0");
    let mut response = StatusCode::NO_CONTENT.into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, HeaderValue::from_str(&cookie).unwrap());
    Ok(response)
}
