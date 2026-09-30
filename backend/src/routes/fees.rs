use axum::extract::{Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use sqlx::PgPool;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::{authorize, resolve_student_id_for_access, AccessContext, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/fees", get(my_fees))
        .route("/api/admin/finance/overview", get(finance_overview))
        .route("/api/admin/finance/fees", get(fee_records))
        .route("/api/admin/finance/collect", post(collect))
}

pub async fn fee_status(pool: &PgPool, ctx: &AccessContext, requested_student_id: Option<i32>) -> AppResult<serde_json::Value> {
    let student_id = resolve_student_id_for_access(pool, ctx, "fees.status.view", requested_student_id).await?;
    let rows = sqlx::query!("select * from fees where student_id = $1", student_id).fetch_all(pool).await?;

    let total_due: f64 = rows.iter().map(|f| f.amount - f.amount_paid).sum();
    let has_overdue = rows.iter().any(|f| f.status == "overdue");

    let items: Vec<_> = rows
        .iter()
        .map(|f| json!({
            "id": f.id, "feeType": f.fee_type, "academicYear": f.academic_year, "semester": f.semester,
            "amount": f.amount, "amountPaid": f.amount_paid, "pending": f.amount - f.amount_paid,
            "dueDate": f.due_date, "status": f.status,
        }))
        .collect();

    Ok(json!({ "studentId": student_id, "items": items, "totalDue": total_due, "hasOverdue": has_overdue }))
}

async fn my_fees(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(fee_status(&state.pool, &ctx, None).await?))
}

async fn finance_overview(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "finance.fees.view", None, AuthorizeOptions::default()).await?;
    let row = sqlx::query!(
        r#"select
            coalesce(sum(amount), 0) as "total_billed!",
            coalesce(sum(amount_paid), 0) as "total_collected!",
            sum(case when status = 'overdue' then 1 else 0 end) as "overdue_count!",
            sum(case when status = 'pending' then 1 else 0 end) as "pending_count!"
           from fees"#
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({
        "totalBilled": row.total_billed,
        "totalCollected": row.total_collected,
        "totalPending": row.total_billed - row.total_collected,
        "overdueCount": row.overdue_count,
        "pendingCount": row.pending_count,
    })))
}

#[derive(Debug, Deserialize)]
struct FeeQuery {
    status: Option<String>,
}

async fn fee_records(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<FeeQuery>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "finance.fees.view", None, AuthorizeOptions::default()).await?;
    let rows = sqlx::query!(
        r#"
        select f.id, f.student_id, s.roll_number, s.first_name, s.last_name, f.fee_type, f.amount, f.amount_paid, f.due_date, f.status
        from fees f join students s on s.id = f.student_id
        where $1::text is null or f.status = $1
        order by f.due_date desc
        limit 100
        "#,
        q.status
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "studentId": r.student_id, "rollNumber": r.roll_number, "firstName": r.first_name, "lastName": r.last_name,
            "feeType": r.fee_type, "amount": r.amount, "amountPaid": r.amount_paid, "dueDate": r.due_date, "status": r.status,
        }))
        .collect();

    Ok(Json(json!({ "fees": out })))
}

#[derive(Debug, Deserialize)]
struct CollectBody {
    #[serde(rename = "feeId")]
    fee_id: i32,
    amount: f64,
    method: Option<String>,
}

async fn collect(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<CollectBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "finance.fees.collect",
        None,
        AuthorizeOptions { resource_label: Some(&format!("fee:{}", body.fee_id)), force_audit: true },
    )
    .await?;

    let fee = sqlx::query!("select amount, amount_paid, student_id from fees where id = $1", body.fee_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Fee record not found.".to_string()))?;

    let new_paid = (fee.amount_paid + body.amount).min(fee.amount);
    let status = if new_paid >= fee.amount { "paid" } else { "partial" };

    sqlx::query!("update fees set amount_paid = $1, status = $2 where id = $3", new_paid, status, body.fee_id)
        .execute(&state.pool)
        .await?;

    let reference = format!("desk_{:x}", chrono::Utc::now().timestamp_millis());
    sqlx::query!(
        r#"insert into payments (fee_id, student_id, amount, method, transaction_ref, status, paid_at)
           values ($1, $2, $3, $4, $5, 'paid', $6)"#,
        body.fee_id,
        fee.student_id,
        body.amount,
        body.method.unwrap_or_else(|| "cash".to_string()),
        reference,
        chrono::Utc::now().to_rfc3339()
    )
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "success": true, "amountPaid": new_paid, "status": status })))
}
