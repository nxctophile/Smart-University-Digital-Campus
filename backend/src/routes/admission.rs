use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::{authorize, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/admin/admissions", get(list).post(onboard))
}

async fn list(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "admission.application.view", None, AuthorizeOptions::default()).await?;

    let admissions = sqlx::query!(
        r#"
        select s.id, s.roll_number, s.first_name, s.last_name, s.email, s.admission_year, s.status,
               d.name as department, p.name as programme, s.created_at
        from students s
        join departments d on d.id = s.department_id
        join programmes p on p.id = s.programme_id
        order by s.created_at desc
        limit 30
        "#
    )
    .fetch_all(&state.pool)
    .await?;
    let programmes = sqlx::query!(
        r#"select p.id, p.name, p.department_id, d.name as department_name from programmes p join departments d on d.id = p.department_id"#
    )
    .fetch_all(&state.pool)
    .await?;

    let admissions: Vec<_> = admissions
        .into_iter()
        .map(|s| json!({
            "id": s.id, "rollNumber": s.roll_number, "firstName": s.first_name, "lastName": s.last_name, "email": s.email,
            "admissionYear": s.admission_year, "status": s.status, "department": s.department, "programme": s.programme, "createdAt": s.created_at,
        }))
        .collect();
    let programmes: Vec<_> = programmes
        .into_iter()
        .map(|p| json!({ "id": p.id, "name": p.name, "departmentId": p.department_id, "departmentName": p.department_name }))
        .collect();

    Ok(Json(json!({ "admissions": admissions, "programmes": programmes })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OnboardBody {
    programme_id: i32,
    roll_number: String,
    first_name: String,
    last_name: String,
    email: String,
    phone: String,
    dob: String,
    gender: String,
}

async fn onboard(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<OnboardBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "student.onboard",
        None,
        AuthorizeOptions { resource_label: Some(&format!("roll:{}", body.roll_number)), force_audit: true },
    )
    .await?;

    let programme = sqlx::query!("select department_id from programmes where id = $1", body.programme_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Programme not found.".to_string()))?;

    let existing = sqlx::query!("select id from students where roll_number = $1", body.roll_number).fetch_optional(&state.pool).await?;
    if existing.is_some() {
        return Err(AppError::BadRequest(format!("Roll number {} is already in use.", body.roll_number)));
    }

    let now = chrono::Utc::now();
    let year = now.format("%Y").to_string().parse::<i32>().unwrap();

    let student = sqlx::query!(
        r#"
        insert into students (university_id, department_id, programme_id, roll_number, first_name, last_name, email, phone, dob, gender,
                               admission_year, current_semester, status, source_system, source_id, last_synced_at)
        values (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, 'active', 'admission_cell', $3, $11)
        returning *
        "#,
        programme.department_id,
        body.programme_id,
        body.roll_number,
        body.first_name,
        body.last_name,
        body.email,
        body.phone,
        body.dob,
        body.gender,
        year,
        now.to_rfc3339()
    )
    .fetch_one(&state.pool)
    .await?;

    let today = now.format("%Y-%m-%d").to_string();
    sqlx::query!(
        "insert into documents (student_id, type, title, issued_at, status) values ($1, 'id_card', 'Student ID Card', $2, 'available')",
        student.id,
        today
    )
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "student": {
        "id": student.id, "rollNumber": student.roll_number, "firstName": student.first_name, "lastName": student.last_name,
        "email": student.email, "status": student.status,
    } })))
}
