use axum::extract::{Path, Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::types::ResourceNeed;
use crate::rbac::{authorize, resolve_student_id_for_access, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/exams", get(schedule))
        .route("/api/exams/results", get(my_results))
        .route("/api/faculty/marks", get(exams_for_course))
        .route("/api/faculty/marks/:examId", get(results_for_exam).post(enter_marks))
        .route("/api/admin/exams/pending", get(pending_publish))
        .route("/api/admin/exams/publish", post(publish))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScheduleRow {
    id: i32,
    name: String,
    exam_type: String,
    date: String,
    start_time: String,
    duration_minutes: i32,
    max_marks: i32,
    course_code: String,
    course_name: String,
}

#[derive(Debug, Deserialize)]
struct StudentQuery {
    #[serde(rename = "studentId")]
    student_id: Option<i32>,
}

async fn schedule(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<StudentQuery>) -> AppResult<Json<serde_json::Value>> {
    let rows = schedule_for(&state.pool, &ctx, q.student_id).await?;
    Ok(Json(json!({ "exams": rows })))
}

pub async fn schedule_for(pool: &sqlx::PgPool, ctx: &crate::rbac::AccessContext, requested_student_id: Option<i32>) -> AppResult<Vec<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(pool, ctx, "exam.schedule.view", requested_student_id).await?;
    let student = sqlx::query!("select programme_id, current_semester from students where id = $1", student_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Student not found.".to_string()))?;

    let rows = sqlx::query_as!(
        ScheduleRow,
        r#"
        select e.id, e.name, e.exam_type, e.date, e.start_time, e.duration_minutes, e.max_marks,
               c.code as course_code, c.name as course_name
        from exams e join courses c on c.id = e.course_id
        where e.programme_id = $1 and e.semester = $2
        order by e.date
        "#,
        student.programme_id,
        student.current_semester
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| serde_json::to_value(r).unwrap()).collect())
}

async fn my_results(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<StudentQuery>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "marks.view", q.student_id).await?;

    let rows = sqlx::query!(
        r#"
        select e.id as exam_id, e.name as exam_name, e.exam_type, e.date, e.max_marks,
               c.code as course_code, c.name as course_name, er.marks_obtained
        from exam_results er
        join exams e on e.id = er.exam_id
        join courses c on c.id = e.course_id
        where er.student_id = $1 and er.graded = true
        order by e.date desc
        "#,
        student_id
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| {
            let percentage = (r.marks_obtained / r.max_marks as f64 * 1000.0).round() / 10.0;
            json!({
                "examId": r.exam_id, "examName": r.exam_name, "examType": r.exam_type, "date": r.date,
                "maxMarks": r.max_marks, "courseCode": r.course_code, "courseName": r.course_name,
                "marksObtained": r.marks_obtained, "percentage": percentage,
            })
        })
        .collect();

    Ok(Json(json!({ "results": out })))
}

#[derive(Debug, Deserialize)]
struct CourseQuery {
    #[serde(rename = "courseId")]
    course_id: i32,
}

async fn exams_for_course(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<CourseQuery>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "marks.create", Some(&ResourceNeed::course(q.course_id)), AuthorizeOptions::default()).await?;
    let rows = sqlx::query!("select * from exams where course_id = $1 order by date", q.course_id).fetch_all(&state.pool).await?;
    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "courseId": r.course_id, "programmeId": r.programme_id, "name": r.name, "examType": r.exam_type,
            "date": r.date, "startTime": r.start_time, "durationMinutes": r.duration_minutes, "maxMarks": r.max_marks, "semester": r.semester,
        }))
        .collect();
    Ok(Json(json!({ "exams": out })))
}

async fn results_for_exam(State(state): State<AppState>, Session(ctx): Session, Path(exam_id): Path<i32>) -> AppResult<Json<serde_json::Value>> {
    let exam = sqlx::query!("select course_id, programme_id, semester from exams where id = $1", exam_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Exam not found.".to_string()))?;
    authorize(&state.pool, &ctx, "marks.create", Some(&ResourceNeed::course(exam.course_id)), AuthorizeOptions::default()).await?;

    let rows = sqlx::query!(
        r#"
        select s.id as student_id, s.roll_number, s.first_name, s.last_name, er.marks_obtained, er.graded
        from students s
        left join exam_results er on er.student_id = s.id and er.exam_id = $1
        where s.programme_id = $2 and s.current_semester = $3
        "#,
        exam_id,
        exam.programme_id,
        exam.semester
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "studentId": r.student_id, "rollNumber": r.roll_number, "firstName": r.first_name, "lastName": r.last_name,
            "marksObtained": r.marks_obtained, "graded": r.graded,
        }))
        .collect();

    Ok(Json(json!({ "roster": out })))
}

#[derive(Debug, Deserialize)]
struct MarksEntry {
    #[serde(rename = "studentId")]
    student_id: i32,
    #[serde(rename = "marksObtained")]
    marks_obtained: f64,
}

#[derive(Debug, Deserialize)]
struct EnterMarksBody {
    entries: Vec<MarksEntry>,
}

async fn enter_marks(State(state): State<AppState>, Session(ctx): Session, Path(exam_id): Path<i32>, Json(body): Json<EnterMarksBody>) -> AppResult<Json<serde_json::Value>> {
    let exam = sqlx::query!("select course_id, max_marks from exams where id = $1", exam_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Exam not found.".to_string()))?;
    authorize(&state.pool, &ctx, "marks.create", Some(&ResourceNeed::course(exam.course_id)), AuthorizeOptions::default()).await?;

    let mut tx = state.pool.begin().await?;
    for entry in &body.entries {
        let clamped = entry.marks_obtained.max(0.0).min(exam.max_marks as f64);
        let existing = sqlx::query!("select id from exam_results where exam_id = $1 and student_id = $2", exam_id, entry.student_id)
            .fetch_optional(&mut *tx)
            .await?;
        if let Some(existing) = existing {
            sqlx::query!("update exam_results set marks_obtained = $1, graded = false where id = $2", clamped, existing.id)
                .execute(&mut *tx)
                .await?;
        } else {
            sqlx::query!(
                "insert into exam_results (exam_id, student_id, marks_obtained, graded) values ($1, $2, $3, false)",
                exam_id,
                entry.student_id,
                clamped
            )
            .execute(&mut *tx)
            .await?;
        }
    }
    tx.commit().await?;

    Ok(Json(json!({ "saved": body.entries.len() })))
}

async fn pending_publish(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "exam.results.manage", None, AuthorizeOptions::default()).await?;

    let rows = sqlx::query!(
        r#"
        select e.id, e.name, e.date, c.code as course_code, c.name as course_name
        from exams e join courses c on c.id = e.course_id
        where e.date::date <= current_date
        order by e.date desc
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let counts = sqlx::query!(
        r#"select exam_id, count(*) as "total!", sum(case when graded = false then 1 else 0 end) as "pending!"
           from exam_results group by exam_id"#
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| {
            let c = counts.iter().find(|c| c.exam_id == r.id);
            json!({
                "id": r.id, "name": r.name, "date": r.date, "courseCode": r.course_code, "courseName": r.course_name,
                "totalEntered": c.map(|c| c.total).unwrap_or(0),
                "pendingPublish": c.map(|c| c.pending).unwrap_or(0),
            })
        })
        .collect();

    Ok(Json(json!({ "exams": out })))
}

#[derive(Debug, Deserialize)]
struct PublishBody {
    #[serde(rename = "examId")]
    exam_id: i32,
}

async fn publish(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<PublishBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "exam.results.publish",
        None,
        AuthorizeOptions { resource_label: Some(&format!("exam:{}", body.exam_id)), force_audit: true },
    )
    .await?;
    let result = sqlx::query!("update exam_results set graded = true where exam_id = $1", body.exam_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "published": result.rows_affected() })))
}
