use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::{authorize, resolve_student_id_for_access, AccessContext, AuthorizeOptions};
use crate::state::AppState;

const DAY_NAMES: [&str; 5] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

pub fn router() -> Router<AppState> {
    Router::new().route("/api/timetable", get(timetable))
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimetableSlot {
    pub id: i32,
    pub day_of_week: i32,
    pub start_time: String,
    pub end_time: String,
    pub room: String,
    pub course_code: String,
    pub course_name: String,
    pub faculty_name: Option<String>,
    pub day_name: &'static str,
}

pub async fn student_timetable(pool: &PgPool, ctx: &AccessContext, requested_student_id: Option<i32>) -> AppResult<Vec<TimetableSlot>> {
    let student_id = resolve_student_id_for_access(pool, ctx, "timetable.view", requested_student_id).await?;
    let student = sqlx::query!("select programme_id, current_semester from students where id = $1", student_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Student not found.".to_string()))?;

    let rows = sqlx::query!(
        r#"
        select ts.id, ts.day_of_week, ts.start_time, ts.end_time, ts.room, c.code as course_code, c.name as course_name,
               f.first_name as "faculty_first_name?", f.last_name as "faculty_last_name?"
        from timetable_slots ts
        join courses c on c.id = ts.course_id
        left join faculty f on f.id = ts.faculty_id
        where ts.programme_id = $1 and ts.semester = $2
        order by ts.day_of_week, ts.start_time
        "#,
        student.programme_id,
        student.current_semester
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| TimetableSlot {
            id: r.id,
            day_of_week: r.day_of_week,
            start_time: r.start_time,
            end_time: r.end_time,
            room: r.room,
            course_code: r.course_code,
            course_name: r.course_name,
            faculty_name: r.faculty_first_name.map(|f| format!("{f} {}", r.faculty_last_name.unwrap_or_default())),
            day_name: DAY_NAMES.get(r.day_of_week as usize).copied().unwrap_or(""),
        })
        .collect())
}

pub async fn next_class(pool: &PgPool, ctx: &AccessContext, requested_student_id: Option<i32>) -> AppResult<Option<serde_json::Value>> {
    let timetable = student_timetable(pool, ctx, requested_student_id).await?;
    if timetable.is_empty() {
        return Ok(None);
    }
    let now = chrono::Local::now();
    let dow = (now.format("%u").to_string().parse::<i32>().unwrap_or(1) - 1).rem_euclid(7);
    let hhmm = now.format("%H:%M").to_string();

    for offset in 0..8 {
        let day = (dow + offset) % 7;
        if day > 4 {
            continue;
        }
        let mut today: Vec<&TimetableSlot> = timetable.iter().filter(|s| s.day_of_week == day).filter(|s| offset != 0 || s.start_time.as_str() > hhmm.as_str()).collect();
        today.sort_by(|a, b| a.start_time.cmp(&b.start_time));
        if let Some(slot) = today.first() {
            let mut value = serde_json::to_value(slot).unwrap();
            value["daysFromNow"] = json!(offset);
            return Ok(Some(value));
        }
    }
    Ok(None)
}

async fn timetable(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    if let Some(faculty_id) = ctx.faculty_id {
        authorize(&state.pool, &ctx, "timetable.view", None, AuthorizeOptions::default()).await?;
        let rows = sqlx::query!(
            r#"
            select ts.id, ts.day_of_week, ts.start_time, ts.end_time, ts.room, c.code as course_code, c.name as course_name, ts.semester
            from timetable_slots ts join courses c on c.id = ts.course_id
            where ts.faculty_id = $1
            order by ts.day_of_week, ts.start_time
            "#,
            faculty_id
        )
        .fetch_all(&state.pool)
        .await?;
        let out: Vec<_> = rows
            .into_iter()
            .map(|r| json!({
                "id": r.id, "dayOfWeek": r.day_of_week, "startTime": r.start_time, "endTime": r.end_time, "room": r.room,
                "courseCode": r.course_code, "courseName": r.course_name, "semester": r.semester,
                "dayName": DAY_NAMES.get(r.day_of_week as usize).copied().unwrap_or(""),
            }))
            .collect();
        return Ok(Json(json!({ "timetable": out })));
    }

    let timetable = student_timetable(&state.pool, &ctx, None).await?;
    Ok(Json(json!({ "timetable": timetable })))
}
