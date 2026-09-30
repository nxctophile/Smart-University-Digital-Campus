use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;

use crate::auth::Session;
use crate::error::AppResult;
use crate::rbac::{authorize, resolve_student_id_for_access, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/academics/performance", get(my_performance))
        .route("/api/admin/at-risk", get(at_risk))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskFactor {
    label: String,
    detail: String,
    severity: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentRisk {
    pub student_id: i32,
    roll_number: String,
    name: String,
    department: String,
    department_code: String,
    programme: String,
    pub programme_id: i32,
    pub semester: i32,
    pub attendance_percentage: f64,
    recent_test_average: f64,
    fee_status: String,
    open_tickets: i64,
    risk_score: i32,
    pub risk_level: &'static str,
    factors: Vec<RiskFactor>,
}

struct RiskRow {
    student_id: i32,
    roll_number: String,
    first_name: String,
    last_name: String,
    current_semester: i32,
    programme_id: i32,
    department: String,
    department_code: String,
    programme: String,
    att_total: i64,
    att_present: i64,
    recent_test_avg: Option<f64>,
    fee_status: Option<String>,
    open_tickets: i64,
}

fn score_row(row: RiskRow) -> StudentRisk {
    let attendance_percentage = if row.att_total > 0 {
        (row.att_present as f64 / row.att_total as f64 * 1000.0).round() / 10.0
    } else {
        100.0
    };
    let recent_test_average = row.recent_test_avg.map(|v| (v * 10.0).round() / 10.0).unwrap_or(100.0);
    let fee_status = row.fee_status.unwrap_or_else(|| "paid".to_string());

    let mut score = 0;
    let mut factors = vec![];

    if attendance_percentage < 60.0 {
        score += 40;
        factors.push(RiskFactor { label: "Attendance".into(), detail: format!("{attendance_percentage}% (below 60%)"), severity: "high" });
    } else if attendance_percentage < 75.0 {
        score += 25;
        factors.push(RiskFactor { label: "Attendance".into(), detail: format!("{attendance_percentage}% (below the 75% requirement)"), severity: "medium" });
    } else if attendance_percentage < 85.0 {
        score += 8;
        factors.push(RiskFactor { label: "Attendance".into(), detail: format!("{attendance_percentage}%"), severity: "low" });
    }

    if recent_test_average < 50.0 {
        score += 35;
        factors.push(RiskFactor { label: "Recent test average".into(), detail: format!("{recent_test_average}%"), severity: "high" });
    } else if recent_test_average < 60.0 {
        score += 20;
        factors.push(RiskFactor { label: "Recent test average".into(), detail: format!("{recent_test_average}%"), severity: "medium" });
    } else if recent_test_average < 70.0 {
        score += 8;
        factors.push(RiskFactor { label: "Recent test average".into(), detail: format!("{recent_test_average}%"), severity: "low" });
    }

    if fee_status == "overdue" {
        score += 15;
        factors.push(RiskFactor { label: "Fee status".into(), detail: "Overdue balance".into(), severity: "medium" });
    } else if fee_status == "pending" {
        score += 4;
        factors.push(RiskFactor { label: "Fee status".into(), detail: "Payment pending".into(), severity: "low" });
    }

    if row.open_tickets > 0 {
        score += 5;
        factors.push(RiskFactor { label: "Open grievances".into(), detail: format!("{} open helpdesk ticket(s)", row.open_tickets), severity: "low" });
    }

    let score = score.min(100);
    let risk_level = if score >= 50 { "high" } else if score >= 25 { "medium" } else { "low" };

    StudentRisk {
        student_id: row.student_id,
        roll_number: row.roll_number,
        name: format!("{} {}", row.first_name, row.last_name),
        department: row.department,
        department_code: row.department_code,
        programme: row.programme,
        programme_id: row.programme_id,
        semester: row.current_semester,
        attendance_percentage,
        recent_test_average,
        fee_status,
        open_tickets: row.open_tickets,
        risk_score: score,
        risk_level,
        factors,
    }
}

// A student can have several fee rows (tuition/hostel/transport/...); the
// lateral join below picks one representative status per student instead of
// fanning a student out into one risk row per fee row.
pub async fn all_student_risk_profiles(pool: &PgPool) -> sqlx::Result<Vec<StudentRisk>> {
    let rows = sqlx::query!(
        r#"
        select
          s.id as "student_id!", s.roll_number, s.first_name, s.last_name, s.current_semester, s.programme_id,
          d.name as department, d.code as department_code, p.name as programme,
          coalesce(att.total, 0) as "att_total!", coalesce(att.present, 0) as "att_present!",
          ex.avg_pct as recent_test_avg,
          fe.status as "fee_status?",
          coalesce(tk.open_count, 0) as "open_tickets!"
        from students s
        join departments d on d.id = s.department_id
        join programmes p on p.id = s.programme_id
        left join (
          select student_id, count(*) total, sum(case when status in ('present','excused') then 1 else 0 end) present
          from attendance group by student_id
        ) att on att.student_id = s.id
        left join (
          select er.student_id, avg(er.marks_obtained * 100.0 / e.max_marks) avg_pct
          from exam_results er join exams e on e.id = er.exam_id
          group by er.student_id
        ) ex on ex.student_id = s.id
        left join lateral (
          select f.status from fees f where f.student_id = s.id
          order by case f.status when 'overdue' then 0 when 'pending' then 1 when 'partial' then 2 else 3 end
          limit 1
        ) fe on true
        left join (
          select student_id, count(*) open_count from helpdesk_tickets
          where status in ('open','in_progress') and student_id is not null
          group by student_id
        ) tk on tk.student_id = s.id
        where s.status = 'active'
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| {
            score_row(RiskRow {
                student_id: r.student_id,
                roll_number: r.roll_number,
                first_name: r.first_name,
                last_name: r.last_name,
                current_semester: r.current_semester,
                programme_id: r.programme_id,
                department: r.department,
                department_code: r.department_code,
                programme: r.programme,
                att_total: r.att_total,
                att_present: r.att_present,
                recent_test_avg: r.recent_test_avg,
                fee_status: r.fee_status,
                open_tickets: r.open_tickets,
            })
        })
        .collect())
}

pub async fn student_risk(pool: &PgPool, student_id: i32) -> sqlx::Result<Option<StudentRisk>> {
    let row = sqlx::query!(
        r#"
        select
          s.id as "student_id!", s.roll_number, s.first_name, s.last_name, s.current_semester, s.programme_id,
          d.name as department, d.code as department_code, p.name as programme,
          coalesce(att.total, 0) as "att_total!", coalesce(att.present, 0) as "att_present!",
          ex.avg_pct as recent_test_avg,
          fe.status as "fee_status?",
          coalesce(tk.open_count, 0) as "open_tickets!"
        from students s
        join departments d on d.id = s.department_id
        join programmes p on p.id = s.programme_id
        left join (
          select student_id, count(*) total, sum(case when status in ('present','excused') then 1 else 0 end) present
          from attendance group by student_id
        ) att on att.student_id = s.id
        left join (
          select er.student_id, avg(er.marks_obtained * 100.0 / e.max_marks) avg_pct
          from exam_results er join exams e on e.id = er.exam_id
          group by er.student_id
        ) ex on ex.student_id = s.id
        left join lateral (
          select f.status from fees f where f.student_id = s.id
          order by case f.status when 'overdue' then 0 when 'pending' then 1 when 'partial' then 2 else 3 end
          limit 1
        ) fe on true
        left join (
          select student_id, count(*) open_count from helpdesk_tickets
          where status in ('open','in_progress') and student_id is not null
          group by student_id
        ) tk on tk.student_id = s.id
        where s.status = 'active' and s.id = $1
        "#,
        student_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| {
        score_row(RiskRow {
            student_id: r.student_id,
            roll_number: r.roll_number,
            first_name: r.first_name,
            last_name: r.last_name,
            current_semester: r.current_semester,
            programme_id: r.programme_id,
            department: r.department,
            department_code: r.department_code,
            programme: r.programme,
            att_total: r.att_total,
            att_present: r.att_present,
            recent_test_avg: r.recent_test_avg,
            fee_status: r.fee_status,
            open_tickets: r.open_tickets,
        })
    }))
}

pub async fn student_risk_for_caller(
    pool: &PgPool,
    ctx: &crate::rbac::AccessContext,
    requested_student_id: Option<i32>,
) -> AppResult<Option<StudentRisk>> {
    let student_id = resolve_student_id_for_access(pool, ctx, "student.performance.view", requested_student_id).await?;
    Ok(student_risk(pool, student_id).await?)
}

#[derive(Debug, Deserialize)]
struct PerformanceQuery {
    #[serde(rename = "studentId")]
    student_id: Option<i32>,
}

async fn my_performance(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<PerformanceQuery>) -> AppResult<Json<serde_json::Value>> {
    let risk = student_risk_for_caller(&state.pool, &ctx, q.student_id).await?;
    Ok(Json(json!({ "risk": risk })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AtRiskQuery {
    max_attendance: Option<f64>,
    risk_level: Option<String>,
    #[serde(rename = "department")]
    department_code: Option<String>,
    exam_within_days: Option<i64>,
    limit: Option<usize>,
    query: Option<String>,
}

async fn at_risk(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<AtRiskQuery>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "student.performance.view", None, AuthorizeOptions::default()).await?;
    let mut rows = all_student_risk_profiles(&state.pool).await?;

    if let Some(max) = q.max_attendance {
        rows.retain(|r| r.attendance_percentage < max);
    }
    if let Some(level) = &q.risk_level {
        rows.retain(|r| r.risk_level == level.as_str());
    }
    if let Some(dept) = &q.department_code {
        rows.retain(|r| &r.department_code == dept);
    }
    if let Some(query) = &q.query {
        let needle = query.to_lowercase();
        rows.retain(|r| r.name.to_lowercase().contains(&needle) || r.roll_number.to_lowercase().contains(&needle));
    }
    if let Some(days) = q.exam_within_days {
        let keys = exam_programme_semester_within(&state.pool, days).await?;
        rows.retain(|r| keys.contains(&(r.programme_id, r.semester)));
    }

    rows.sort_by_key(|r| std::cmp::Reverse(r.risk_score));
    if let Some(limit) = q.limit {
        rows.truncate(limit);
    }

    Ok(Json(json!({ "students": rows })))
}

async fn exam_programme_semester_within(pool: &PgPool, days: i64) -> sqlx::Result<std::collections::HashSet<(i32, i32)>> {
    let rows = sqlx::query!(
        r#"select distinct programme_id, semester from exams
           where date::date between current_date and (current_date + $1::int * interval '1 day')"#,
        days as i32
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| (r.programme_id, r.semester)).collect())
}
