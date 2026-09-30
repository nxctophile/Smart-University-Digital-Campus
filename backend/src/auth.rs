use std::collections::HashSet;

use axum::async_trait;
use axum::extract::FromRequestParts;
use axum::http::header;
use axum::http::request::Parts;
use sqlx::PgPool;

use crate::config::COOKIE_NAME;
use crate::error::AppError;
use crate::rbac::grants::{load_grants_for_user, load_role_labels_for_user};
use crate::rbac::types::AccessContext;
use crate::state::AppState;

fn cookie_user_id(parts: &Parts) -> Option<i32> {
    let header = parts.headers.get(header::COOKIE)?.to_str().ok()?;
    for cookie in cookie::Cookie::split_parse(header) {
        let cookie = cookie.ok()?;
        if cookie.name() == COOKIE_NAME {
            return cookie.value().parse().ok();
        }
    }
    None
}

pub async fn load_context(pool: &PgPool, user_id: i32) -> Result<AccessContext, AppError> {
    let user = sqlx::query!(
        "select id, name, role, student_id, faculty_id, parent_id, employee_id from users where id = $1",
        user_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::Unauthenticated)?;

    let mut department_id: Option<i32> = None;
    if let Some(faculty_id) = user.faculty_id {
        department_id = sqlx::query!("select department_id from faculty where id = $1", faculty_id)
            .fetch_optional(pool)
            .await?
            .map(|r| r.department_id);
    } else if let Some(employee_id) = user.employee_id {
        department_id = sqlx::query!("select department_id from employees where id = $1", employee_id)
            .fetch_optional(pool)
            .await?
            .map(|r| r.department_id);
    }

    let department_name = if let Some(department_id) = department_id {
        sqlx::query!("select name from departments where id = $1", department_id)
            .fetch_optional(pool)
            .await?
            .map(|r| r.name)
    } else {
        None
    };

    let grants = load_grants_for_user(pool, user.id).await?;
    let roles = load_role_labels_for_user(pool, user.id).await?;
    let permissions: Vec<String> = grants
        .iter()
        .map(|g| g.permission.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    Ok(AccessContext {
        user_id: user.id,
        role: user.role,
        name: user.name,
        student_id: user.student_id,
        faculty_id: user.faculty_id,
        parent_id: user.parent_id,
        employee_id: user.employee_id,
        department_id,
        department_name,
        roles,
        permissions,
        grants,
    })
}

/// Extractor for a required, valid session. Mirrors getCurrentContext() on
/// the Next.js side: missing or stale cookie both surface as Unauthenticated.
pub struct Session(pub AccessContext);

#[async_trait]
impl FromRequestParts<AppState> for Session {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let user_id = cookie_user_id(parts).ok_or(AppError::Unauthenticated)?;
        let ctx = load_context(&state.pool, user_id).await?;
        Ok(Session(ctx))
    }
}
