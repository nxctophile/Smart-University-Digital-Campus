use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::{authorize, AuthorizeOptions};
use crate::routes::risk::all_student_risk_profiles;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/faculty/courses", get(my_courses))
        .route("/api/faculty/students", get(students_in_course))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CourseRow {
    section_id: i32,
    course_id: i32,
    course_code: String,
    course_name: String,
    programme_id: i32,
    semester: i32,
    academic_year: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CourseWithStats {
    #[serde(flatten)]
    course: CourseRow,
    student_count: usize,
    avg_attendance: f64,
    at_risk_count: usize,
}

async fn my_courses(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "class.view", None, AuthorizeOptions::default()).await?;
    let Some(faculty_id) = ctx.faculty_id else {
        return Ok(Json(json!({ "courses": [] })));
    };

    let courses = sqlx::query_as!(
        CourseRow,
        r#"
        select se.id as section_id, c.id as course_id, c.code as course_code, c.name as course_name,
               c.programme_id, c.semester, se.academic_year
        from sections se
        join courses c on c.id = se.course_id
        where se.faculty_id = $1
        "#,
        faculty_id
    )
    .fetch_all(&state.pool)
    .await?;

    let risk = all_student_risk_profiles(&state.pool).await?;

    let out: Vec<CourseWithStats> = courses
        .into_iter()
        .map(|course| {
            let roster: Vec<_> = risk.iter().filter(|r| r.programme_id == course.programme_id && r.semester == course.semester).collect();
            let avg_attendance = if roster.is_empty() {
                0.0
            } else {
                (roster.iter().map(|r| r.attendance_percentage).sum::<f64>() / roster.len() as f64 * 10.0).round() / 10.0
            };
            let at_risk_count = roster.iter().filter(|r| r.risk_level != "low").count();
            CourseWithStats { student_count: roster.len(), avg_attendance, at_risk_count, course }
        })
        .collect();

    Ok(Json(json!({ "courses": out })))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RosterStudent {
    id: i32,
    roll_number: String,
    first_name: String,
    last_name: String,
    avatar_color: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CourseQuery {
    #[serde(rename = "courseId")]
    course_id: i32,
}

async fn students_in_course(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<CourseQuery>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "class.view", None, AuthorizeOptions::default()).await?;

    let course = sqlx::query!("select programme_id, semester from courses where id = $1", q.course_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Course not found.".to_string()))?;

    let roster = sqlx::query_as!(
        RosterStudent,
        r#"select id, roll_number, first_name, last_name, avatar_color
           from students where programme_id = $1 and current_semester = $2"#,
        course.programme_id,
        course.semester
    )
    .fetch_all(&state.pool)
    .await?;

    let risk = all_student_risk_profiles(&state.pool).await?;
    let out: Vec<_> = roster
        .into_iter()
        .map(|s| {
            let r = risk.iter().find(|r| r.student_id == s.id);
            json!({ "id": s.id, "rollNumber": s.roll_number, "firstName": s.first_name, "lastName": s.last_name, "avatarColor": s.avatar_color, "risk": r })
        })
        .collect();

    Ok(Json(json!({ "students": out })))
}
