use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use hmac::{Hmac, Mac};
use serde::Deserialize;
use serde_json::json;
use sha2::Sha256;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::resolve_student_id_for_access;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/payments/create-order", post(create_order))
        .route("/api/payments/verify", post(verify))
        .route("/api/payments/reset", post(reset))
        .route("/api/payments/history", get(history))
}

async fn history(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "fees.status.view", None).await?;
    let rows = sqlx::query!(
        r#"
        select p.id, p.amount, p.method, p.transaction_ref, p.status, p.paid_at, f.fee_type, f.academic_year, f.semester
        from payments p join fees f on f.id = p.fee_id
        where p.student_id = $1 and p.status = 'paid'
        order by p.paid_at desc
        "#,
        student_id
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "amount": r.amount, "method": r.method, "transactionRef": r.transaction_ref, "status": r.status,
            "paidAt": r.paid_at, "feeType": r.fee_type, "academicYear": r.academic_year, "semester": r.semester,
        }))
        .collect();

    Ok(Json(json!({ "payments": out })))
}

#[derive(Debug, Deserialize)]
struct FeeIdBody {
    #[serde(rename = "feeId")]
    fee_id: i32,
}

async fn create_order(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<FeeIdBody>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "fees.pay", None).await?;
    let fee = sqlx::query!("select amount, amount_paid, student_id from fees where id = $1", body.fee_id)
        .fetch_optional(&state.pool)
        .await?
        .filter(|f| f.student_id == student_id)
        .ok_or_else(|| AppError::BadRequest("Fee record not found.".to_string()))?;

    let pending = ((fee.amount - fee.amount_paid) * 100.0).round() / 100.0;
    if pending <= 0.0 {
        return Err(AppError::BadRequest("This fee is already paid.".to_string()));
    }

    // Real Razorpay order creation would call out to their API here; this
    // deployment runs fee payments in demo mode by default (see README),
    // same as the original Next.js prototype without RAZORPAY_* configured.
    let order_id = format!("demo_order_{:x}", chrono::Utc::now().timestamp_millis());
    sqlx::query!(
        r#"insert into payments (fee_id, student_id, amount, method, transaction_ref, status, razorpay_order_id, paid_at)
           values ($1, $2, $3, 'razorpay', $4, 'created', $4, $5)"#,
        body.fee_id,
        student_id,
        pending,
        order_id,
        chrono::Utc::now().to_rfc3339()
    )
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({
        "orderId": order_id, "amount": (pending * 100.0).round() as i64, "currency": "INR", "keyId": null, "demoMode": true,
    })))
}

#[derive(Debug, Deserialize)]
struct VerifyBody {
    #[serde(rename = "feeId")]
    fee_id: i32,
    #[serde(rename = "orderId")]
    order_id: String,
    #[serde(rename = "paymentId")]
    payment_id: String,
    signature: Option<String>,
}

async fn verify(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<VerifyBody>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "fees.pay", None).await?;
    let _fee = sqlx::query!("select amount, student_id from fees where id = $1", body.fee_id)
        .fetch_optional(&state.pool)
        .await?
        .filter(|f| f.student_id == student_id)
        .ok_or_else(|| AppError::BadRequest("Fee record not found.".to_string()))?;

    let payment = sqlx::query!("select id, amount from payments where razorpay_order_id = $1 and fee_id = $2", body.order_id, body.fee_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Payment order not found - start a new payment.".to_string()))?;

    let is_demo = body.order_id.starts_with("demo_order_");
    if !is_demo {
        let secret = std::env::var("RAZORPAY_KEY_SECRET").map_err(|_| AppError::BadRequest("Payment gateway is not configured.".to_string()))?;
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("hmac accepts any key length");
        mac.update(format!("{}|{}", body.order_id, body.payment_id).as_bytes());
        let expected = hex::encode(mac.finalize().into_bytes());
        if Some(expected) != body.signature {
            return Err(AppError::BadRequest("Payment signature verification failed.".to_string()));
        }
    }

    sqlx::query!(
        "update payments set status = 'paid', razorpay_payment_id = $1, razorpay_signature = $2, paid_at = $3, transaction_ref = $1 where id = $4",
        body.payment_id,
        body.signature,
        chrono::Utc::now().to_rfc3339(),
        payment.id
    )
    .execute(&state.pool)
    .await?;

    sqlx::query!("update fees set amount_paid = amount, status = 'paid' where id = $1", body.fee_id).execute(&state.pool).await?;

    Ok(Json(json!({ "success": true, "amount": payment.amount, "demoMode": is_demo })))
}

async fn reset(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<FeeIdBody>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "fees.pay", None).await?;
    let _fee = sqlx::query!("select student_id from fees where id = $1", body.fee_id)
        .fetch_optional(&state.pool)
        .await?
        .filter(|f| f.student_id == student_id)
        .ok_or_else(|| AppError::BadRequest("Fee record not found.".to_string()))?;

    sqlx::query!("update fees set amount_paid = 0, status = 'pending' where id = $1", body.fee_id).execute(&state.pool).await?;
    Ok(Json(json!({ "success": true })))
}
