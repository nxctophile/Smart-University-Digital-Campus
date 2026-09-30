use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::auth::Session;
use crate::error::AppResult;
use crate::rbac::resolve_student_id_for_access;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/backlogs", get(backlogs))
}

const PASS_PERCENTAGE: f64 = 33.0;

#[derive(Debug, Deserialize)]
struct BacklogsQuery {
    #[serde(rename = "studentId")]
    student_id: Option<i32>,
}

async fn backlogs(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<BacklogsQuery>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "marks.view", q.student_id).await?;

    // Most recent graded result per course - a course still below the pass
    // mark on its latest attempt counts as an active backlog.
    let rows = sqlx::query!(
        r#"
        select distinct on (c.id)
          c.id as course_id, c.code as course_code, c.name as course_name, c.semester,
          e.name as exam_name, e.date, er.marks_obtained, e.max_marks
        from exam_results er
        join exams e on e.id = er.exam_id
        join courses c on c.id = e.course_id
        where er.student_id = $1 and er.graded = true
        order by c.id, e.date desc
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
                "courseId": r.course_id, "courseCode": r.course_code, "courseName": r.course_name, "semester": r.semester,
                "examName": r.exam_name, "date": r.date, "marksObtained": r.marks_obtained, "maxMarks": r.max_marks,
                "percentage": percentage, "status": if percentage < PASS_PERCENTAGE { "pending" } else { "cleared" },
            })
        })
        .collect();

    let pending_count = out.iter().filter(|r| r["status"] == json!("pending")).count();

    Ok(Json(json!({ "courses": out, "pendingCount": pending_count })))
}
