use axum::extract::{Query, State};
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
        .route("/api/library/catalog", get(catalog))
        .route("/api/library/loans", get(my_loans))
        .route("/api/admin/library/overview", get(overview))
        .route("/api/admin/library/overdue", get(overdue))
        .route("/api/admin/library/return", post(return_book))
}

#[derive(Debug, Deserialize)]
struct CatalogQuery {
    query: Option<String>,
}

async fn catalog(State(state): State<AppState>, Query(q): Query<CatalogQuery>) -> AppResult<Json<serde_json::Value>> {
    let needle = q.query.filter(|s| !s.trim().is_empty()).map(|s| format!("%{s}%"));
    let rows = sqlx::query!(
        r#"select * from books where $1::text is null or title ilike $1 or author ilike $1 or category ilike $1 limit 30"#,
        needle
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|b| json!({
            "id": b.id, "isbn": b.isbn, "title": b.title, "author": b.author, "category": b.category, "publisher": b.publisher,
            "totalCopies": b.total_copies, "availableCopies": b.available_copies, "shelfLocation": b.shelf_location,
        }))
        .collect();

    Ok(Json(json!({ "books": out })))
}

async fn my_loans(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "library.loan.view", None).await?;
    let rows = sqlx::query!(
        r#"
        select bl.id, b.title, b.author, b.category, bl.borrowed_at, bl.due_at, bl.returned_at, bl.status, bl.fine_amount, bl.fine_paid
        from book_loans bl join books b on b.id = bl.book_id
        where bl.student_id = $1
        order by bl.borrowed_at
        "#,
        student_id
    )
    .fetch_all(&state.pool)
    .await?;

    let active_count = rows.iter().filter(|r| r.status != "returned").count();
    let total_fine: f64 = rows.iter().filter(|r| !r.fine_paid).map(|r| r.fine_amount).sum();

    let mut loans: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "title": r.title, "author": r.author, "category": r.category, "borrowedAt": r.borrowed_at,
            "dueAt": r.due_at, "returnedAt": r.returned_at, "status": r.status, "fineAmount": r.fine_amount, "finePaid": r.fine_paid,
        }))
        .collect();
    loans.reverse();

    Ok(Json(json!({ "loans": loans, "activeCount": active_count, "totalFine": total_fine })))
}

async fn overview(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "library.book.manage", None, AuthorizeOptions::default()).await?;

    let totals = sqlx::query!(
        r#"select count(*) as "titles!", coalesce(sum(total_copies),0) as "total_copies!", coalesce(sum(available_copies),0) as "available_copies!" from books"#
    )
    .fetch_one(&state.pool)
    .await?;

    let loan_stats = sqlx::query!(
        r#"select
            sum(case when status = 'active' then 1 else 0 end) as active_loans,
            sum(case when status = 'overdue' then 1 else 0 end) as overdue_loans,
            coalesce(sum(case when fine_paid = false then fine_amount else 0 end), 0) as "outstanding_fines!"
           from book_loans"#
    )
    .fetch_one(&state.pool)
    .await?;

    let by_category = sqlx::query!(r#"select category, count(*) as "titles!", coalesce(sum(total_copies),0) as "copies!" from books group by category order by 3 desc"#)
        .fetch_all(&state.pool)
        .await?;

    Ok(Json(json!({
        "titles": totals.titles,
        "totalCopies": totals.total_copies,
        "availableCopies": totals.available_copies,
        "borrowedCopies": totals.total_copies - totals.available_copies,
        "activeLoans": loan_stats.active_loans.unwrap_or(0),
        "overdueLoans": loan_stats.overdue_loans.unwrap_or(0),
        "outstandingFines": loan_stats.outstanding_fines,
        "byCategory": by_category.into_iter().map(|c| json!({ "category": c.category, "titles": c.titles, "copies": c.copies })).collect::<Vec<_>>(),
    })))
}

async fn overdue(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "library.book.manage", None, AuthorizeOptions::default()).await?;
    let rows = sqlx::query!(
        r#"
        select bl.id, bl.due_at, bl.fine_amount, b.title, s.roll_number, s.first_name, s.last_name
        from book_loans bl
        join books b on b.id = bl.book_id
        join students s on s.id = bl.student_id
        where bl.status = 'overdue'
        order by bl.due_at asc
        limit 100
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "dueAt": r.due_at, "fineAmount": r.fine_amount, "title": r.title,
            "rollNumber": r.roll_number, "firstName": r.first_name, "lastName": r.last_name,
        }))
        .collect();

    Ok(Json(json!({ "loans": out })))
}

#[derive(Debug, Deserialize)]
struct ReturnBody {
    #[serde(rename = "loanId")]
    loan_id: i32,
}

async fn return_book(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<ReturnBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "library.issue.return", None, AuthorizeOptions::default()).await?;
    let loan = sqlx::query!("select * from book_loans where id = $1", body.loan_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Loan not found.".to_string()))?;

    if loan.status == "returned" {
        return Ok(Json(json!({ "loan": {
            "id": loan.id, "bookId": loan.book_id, "studentId": loan.student_id, "status": loan.status,
            "borrowedAt": loan.borrowed_at, "dueAt": loan.due_at, "returnedAt": loan.returned_at,
        } })));
    }

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    sqlx::query!("update book_loans set status = 'returned', returned_at = $1 where id = $2", today, loan.id).execute(&state.pool).await?;
    sqlx::query!("update books set available_copies = available_copies + 1 where id = $1", loan.book_id).execute(&state.pool).await?;

    Ok(Json(json!({ "loan": {
        "id": loan.id, "bookId": loan.book_id, "studentId": loan.student_id, "status": "returned",
        "borrowedAt": loan.borrowed_at, "dueAt": loan.due_at, "returnedAt": today,
    } })))
}
