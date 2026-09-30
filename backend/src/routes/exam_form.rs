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
        .route("/api/exam-form", get(current))
        .route("/api/exam-form/submit", post(submit))
        .route("/api/admin/exam-form/windows", get(list_windows).post(create_window))
}

async fn current(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "exam.form.fill", None).await?;
    let student = sqlx::query!(
        r#"
        select s.first_name, s.last_name, s.roll_number, s.current_semester, s.programme_id,
               p.name as programme, d.name as department
        from students s join programmes p on p.id = s.programme_id join departments d on d.id = p.department_id
        where s.id = $1
        "#,
        student_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Student not found.".to_string()))?;

    let window = sqlx::query!(
        "select * from exam_form_windows where semester = $1 and published = true order by id desc limit 1",
        student.current_semester
    )
    .fetch_optional(&state.pool)
    .await?;

    let courses = sqlx::query!(
        "select id, code, name, credits from courses where programme_id = $1 and semester = $2 order by code",
        student.programme_id,
        student.current_semester
    )
    .fetch_all(&state.pool)
    .await?;

    let submission = if let Some(w) = &window {
        sqlx::query!("select id, submitted_at, course_ids from exam_form_submissions where window_id = $1 and student_id = $2", w.id, student_id)
            .fetch_optional(&state.pool)
            .await?
    } else {
        None
    };

    Ok(Json(json!({
        "student": { "firstName": student.first_name, "lastName": student.last_name, "rollNumber": student.roll_number,
                     "semester": student.current_semester, "programme": student.programme, "department": student.department },
        "window": window.map(|w| json!({ "id": w.id, "name": w.name, "opensAt": w.opens_at, "closesAt": w.closes_at })),
        "courses": courses.into_iter().map(|c| json!({ "id": c.id, "code": c.code, "name": c.name, "credits": c.credits })).collect::<Vec<_>>(),
        "submission": submission.map(|s| json!({ "id": s.id, "submittedAt": s.submitted_at, "courseIds": s.course_ids })),
    })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitBody {
    window_id: i32,
    course_ids: Vec<i32>,
}

async fn submit(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<SubmitBody>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "exam.form.fill", None).await?;

    let course_ids_json = serde_json::to_value(&body.course_ids).unwrap();
    let row = sqlx::query!(
        r#"insert into exam_form_submissions (window_id, student_id, course_ids) values ($1, $2, $3)
           on conflict (window_id, student_id) do update set submitted_at = now(), course_ids = excluded.course_ids
           returning id, submitted_at"#,
        body.window_id,
        student_id,
        course_ids_json
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({ "submission": { "id": row.id, "submittedAt": row.submitted_at } })))
}

async fn list_windows(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "exam.form.manage", None, AuthorizeOptions::default()).await?;
    let rows = sqlx::query!("select * from exam_form_windows order by id desc").fetch_all(&state.pool).await?;
    let out: Vec<_> = rows
        .into_iter()
        .map(|w| json!({ "id": w.id, "name": w.name, "semester": w.semester, "opensAt": w.opens_at, "closesAt": w.closes_at, "published": w.published }))
        .collect();
    Ok(Json(json!({ "windows": out })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateWindowBody {
    name: String,
    semester: i32,
    opens_at: String,
    closes_at: String,
}

async fn create_window(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<CreateWindowBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "exam.form.manage", None, AuthorizeOptions { resource_label: None, force_audit: true }).await?;
    let row = sqlx::query!(
        "insert into exam_form_windows (name, semester, opens_at, closes_at, published) values ($1, $2, $3, $4, true) returning id",
        body.name,
        body.semester,
        body.opens_at,
        body.closes_at
    )
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(json!({ "window": { "id": row.id } })))
}
