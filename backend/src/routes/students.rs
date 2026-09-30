use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::{authorize, resolve_student_id_for_access, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/admin/students", get(search))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentProfile {
    pub id: i32,
    roll_number: String,
    first_name: String,
    last_name: String,
    email: String,
    phone: String,
    dob: String,
    gender: String,
    admission_year: i32,
    current_semester: i32,
    status: String,
    avatar_color: Option<String>,
    department: String,
    department_code: String,
    programme: String,
    degree_level: String,
}

pub async fn student_profile(pool: &sqlx::PgPool, ctx: &crate::rbac::AccessContext, requested_student_id: Option<i32>) -> AppResult<StudentProfile> {
    let student_id = resolve_student_id_for_access(pool, ctx, "profile.view", requested_student_id).await?;
    let row = sqlx::query_as!(
        StudentProfile,
        r#"
        select s.id, s.roll_number, s.first_name, s.last_name, s.email, s.phone, s.dob, s.gender,
               s.admission_year, s.current_semester, s.status, s.avatar_color,
               d.name as department, d.code as department_code, p.name as programme, p.degree_level
        from students s
        join departments d on d.id = s.department_id
        join programmes p on p.id = s.programme_id
        where s.id = $1
        "#,
        student_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Student not found.".to_string()))?;
    Ok(row)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StudentSearchRow {
    id: i32,
    roll_number: String,
    first_name: String,
    last_name: String,
    email: String,
    current_semester: i32,
    status: String,
    department: String,
    department_code: String,
    programme: String,
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    query: Option<String>,
    department: Option<String>,
    status: Option<String>,
    limit: Option<i64>,
}

async fn search(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<SearchQuery>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "student.view", None, AuthorizeOptions::default()).await?;

    let like = q.query.as_ref().map(|v| format!("%{v}%"));
    let limit = q.limit.unwrap_or(50);

    let rows = sqlx::query_as!(
        StudentSearchRow,
        r#"
        select s.id, s.roll_number, s.first_name, s.last_name, s.email, s.current_semester, s.status,
               d.name as department, d.code as department_code, p.name as programme
        from students s
        join departments d on d.id = s.department_id
        join programmes p on p.id = s.programme_id
        where ($1::text is null or s.first_name ilike $1 or s.last_name ilike $1 or s.roll_number ilike $1 or s.email ilike $1)
          and ($2::text is null or s.status = $2)
          and ($3::text is null or d.code = $3)
        limit $4
        "#,
        like,
        q.status,
        q.department,
        limit
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(json!({ "students": rows })))
}
