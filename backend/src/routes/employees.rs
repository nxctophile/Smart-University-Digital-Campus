use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

use crate::auth::Session;
use crate::error::AppResult;
use crate::rbac::{authorize, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/admin/employees", get(directory))
}

async fn directory(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "employee.view", None, AuthorizeOptions::default()).await?;

    let faculty = sqlx::query!(
        r#"select f.id, f.employee_id, f.first_name, f.last_name, f.email, f.phone, f.designation, f.department_id, d.name as department_name
           from faculty f join departments d on d.id = f.department_id"#
    )
    .fetch_all(&state.pool)
    .await?;
    let staff = sqlx::query!(
        r#"select e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.designation, e.department_id, d.name as department_name
           from employees e join departments d on d.id = e.department_id"#
    )
    .fetch_all(&state.pool)
    .await?;

    let mut staff_directory: Vec<_> = faculty
        .into_iter()
        .map(|f| json!({
            "id": f.id, "employeeCode": f.employee_id, "firstName": f.first_name, "lastName": f.last_name, "email": f.email,
            "phone": f.phone, "designation": f.designation, "departmentId": f.department_id, "departmentName": f.department_name, "kind": "faculty",
        }))
        .chain(staff.into_iter().map(|s| json!({
            "id": s.id, "employeeCode": s.employee_code, "firstName": s.first_name, "lastName": s.last_name, "email": s.email,
            "phone": s.phone, "designation": s.designation, "departmentId": s.department_id, "departmentName": s.department_name, "kind": "staff",
        })))
        .collect();
    staff_directory.sort_by(|a, b| a["lastName"].as_str().unwrap_or("").cmp(b["lastName"].as_str().unwrap_or("")));

    let faculty_count = sqlx::query!(r#"select count(*) as "c!" from faculty"#).fetch_one(&state.pool).await?.c;
    let staff_count = sqlx::query!(r#"select count(*) as "c!" from employees"#).fetch_one(&state.pool).await?.c;
    let by_department = sqlx::query!(
        r#"select d.name, count(*) as "count!" from employees e join departments d on d.id = e.department_id group by d.name"#
    )
    .fetch_all(&state.pool)
    .await?;

    let overview = json!({
        "facultyCount": faculty_count, "staffCount": staff_count, "totalStaff": faculty_count + staff_count,
        "byDepartment": by_department.into_iter().map(|r| json!({ "name": r.name, "count": r.count })).collect::<Vec<_>>(),
    });

    Ok(Json(json!({ "staff": staff_directory, "overview": overview })))
}
