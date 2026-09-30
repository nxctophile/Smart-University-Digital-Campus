use std::collections::HashMap;

use axum::extract::{Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auth::Session;
use crate::error::AppResult;
use crate::rbac::types::ResourceNeed;
use crate::rbac::{authorize, resolve_student_id_for_access, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/attendance", get(summary))
        .route("/api/attendance/history", get(history))
        .route("/api/faculty/attendance", post(mark))
}

#[derive(Debug, Deserialize)]
struct HistoryQuery {
    #[serde(rename = "studentId")]
    student_id: Option<i32>,
}

async fn history(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<HistoryQuery>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "attendance.view", q.student_id).await?;
    let rows = sqlx::query!(
        r#"
        select a.date, a.status, c.code as course_code, c.name as course_name
        from attendance a join courses c on c.id = a.course_id
        where a.student_id = $1
        order by a.date desc
        limit 500
        "#,
        student_id
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows.into_iter().map(|r| json!({ "date": r.date, "status": r.status, "courseCode": r.course_code, "courseName": r.course_name })).collect();
    Ok(Json(json!({ "records": out })))
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CourseAttendance {
    course_id: i32,
    course_code: String,
    course_name: String,
    present: i64,
    absent: i64,
    late: i64,
    excused: i64,
    total: i64,
    percentage: f64,
}

#[derive(Debug, Deserialize)]
struct SummaryQuery {
    #[serde(rename = "studentId")]
    student_id: Option<i32>,
}

async fn summary(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<SummaryQuery>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "attendance.view", q.student_id).await?;
    Ok(Json(summary_for(&state.pool, &ctx, student_id).await?))
}

pub async fn summary_for(pool: &sqlx::PgPool, _ctx: &crate::rbac::AccessContext, student_id: i32) -> AppResult<serde_json::Value> {
    let rows = sqlx::query!(
        r#"
        select c.id as course_id, c.code as course_code, c.name as course_name, a.status, count(*) as "count!"
        from attendance a
        join courses c on c.id = a.course_id
        where a.student_id = $1
        group by c.id, c.code, c.name, a.status
        "#,
        student_id
    )
    .fetch_all(pool)
    .await?;

    let mut by_course: HashMap<i32, CourseAttendance> = HashMap::new();
    for r in &rows {
        let entry = by_course.entry(r.course_id).or_insert_with(|| CourseAttendance {
            course_id: r.course_id,
            course_code: r.course_code.clone(),
            course_name: r.course_name.clone(),
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            total: 0,
            percentage: 0.0,
        });
        match r.status.as_str() {
            "present" => entry.present += r.count,
            "absent" => entry.absent += r.count,
            "late" => entry.late += r.count,
            "excused" => entry.excused += r.count,
            _ => {}
        }
        entry.total += r.count;
    }

    let mut courses: Vec<CourseAttendance> = by_course.into_values().collect();
    for c in &mut courses {
        c.percentage = if c.total > 0 { ((c.present + c.excused) as f64 / c.total as f64 * 1000.0).round() / 10.0 } else { 0.0 };
    }
    courses.sort_by_key(|c| c.course_id);

    let total_present: i64 = courses.iter().map(|c| c.present + c.excused).sum();
    let total_sessions: i64 = courses.iter().map(|c| c.total).sum();
    let overall_percentage = if total_sessions > 0 { (total_present as f64 / total_sessions as f64 * 1000.0).round() / 10.0 } else { 0.0 };

    Ok(json!({
        "studentId": student_id,
        "courses": courses,
        "overallPercentage": overall_percentage,
        "totalSessions": total_sessions,
    }))
}

#[derive(Debug, Deserialize)]
struct AttendanceMark {
    #[serde(rename = "studentId")]
    student_id: i32,
    status: String,
}

#[derive(Debug, Deserialize)]
struct MarkBody {
    #[serde(rename = "courseId")]
    course_id: i32,
    date: String,
    records: Vec<AttendanceMark>,
}

async fn mark(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<MarkBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "attendance.create", Some(&ResourceNeed::course(body.course_id)), AuthorizeOptions::default()).await?;

    let mut tx = state.pool.begin().await?;
    for rec in &body.records {
        let existing = sqlx::query!(
            "select id from attendance where course_id = $1 and date = $2 and student_id = $3",
            body.course_id,
            body.date,
            rec.student_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(existing) = existing {
            sqlx::query!("update attendance set status = $1, marked_by = $2 where id = $3", rec.status, ctx.name, existing.id)
                .execute(&mut *tx)
                .await?;
        } else {
            sqlx::query!(
                "insert into attendance (student_id, course_id, date, status, marked_by) values ($1, $2, $3, $4, $5)",
                rec.student_id,
                body.course_id,
                body.date,
                rec.status,
                ctx.name
            )
            .execute(&mut *tx)
            .await?;
        }
    }
    tx.commit().await?;

    Ok(Json(json!({ "marked": body.records.len() })))
}
