pub mod account;
pub mod admin;
pub mod admission;
pub mod attendance;
pub mod backlogs;
pub mod dashboard;
mod demo;
pub mod documents;
pub mod employees;
pub mod exam_form;
pub mod exam_review;
pub mod exams;
pub mod faculty;
pub mod fees;
pub mod helpdesk;
pub mod hostel;
pub mod import_data;
pub mod leave;
pub mod library;
pub mod locker;
pub mod notifications;
pub mod payments;
pub mod profile;
pub mod profile_edit;
pub mod rbac_admin;
pub mod risk;
pub mod scholarships;
pub mod students;
pub mod timetable;
pub mod transport;

use axum::routing::get;
use axum::Router;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .merge(demo::router())
        .merge(risk::router())
        .merge(students::router())
        .merge(faculty::router())
        .merge(attendance::router())
        .merge(exams::router())
        .merge(timetable::router())
        .merge(fees::router())
        .merge(documents::router())
        .merge(dashboard::router())
        .merge(profile::router())
        .merge(payments::router())
        .merge(hostel::router())
        .merge(transport::router())
        .merge(helpdesk::router())
        .merge(notifications::router())
        .merge(library::router())
        .merge(scholarships::router())
        .merge(employees::router())
        .merge(admission::router())
        .merge(admin::router())
        .merge(rbac_admin::router())
        .merge(import_data::router())
        .merge(account::router())
        .merge(backlogs::router())
        .merge(exam_form::router())
        .merge(exam_review::router())
        .merge(leave::router())
        .merge(locker::router())
        .merge(profile_edit::router())
}
