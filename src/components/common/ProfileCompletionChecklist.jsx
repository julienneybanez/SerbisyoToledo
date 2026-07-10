import { useState } from 'react';
import { Link } from 'react-router-dom';
import './ProfileCompletionChecklist.css';

export default function ProfileCompletionChecklist({
  title = 'Getting Started',
  tasks = [],
  loading = false,
  error = '',
  initiallyCollapsed = false,
}) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);

  const visibleTasks = tasks.filter((task) => task && task.isApplicable !== false);
  const completedCount = visibleTasks.filter((task) => task.completed).length;
  const progress = visibleTasks.length > 0 ? Math.round((completedCount / visibleTasks.length) * 100) : 100;

  if (!loading && !error && visibleTasks.length === 0) {
    return null;
  }

  return (
    <section className="profile-checklist card border-0 shadow-sm" aria-label="Profile completion checklist">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center gap-3">
          <div>
            <h2 className="h5 mb-1">{title}</h2>
            {!loading && !error && (
              <p className="text-muted mb-0">Profile setup: {progress}% complete</p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>

        {loading && (
          <div className="checklist-loading mt-3">
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            <span>Checking your setup...</span>
          </div>
        )}

        {!loading && error && (
          <div className="alert alert-light border mt-3 mb-0" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && !collapsed && (
          <>
            <div className="progress mt-3" role="progressbar" aria-label="Profile setup progress" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>

            {progress === 100 ? (
              <div className="alert alert-success mt-3 mb-0">
                Great work. Your profile setup is complete.
              </div>
            ) : (
              <ul className="list-group list-group-flush checklist-list mt-3">
                {visibleTasks.map((task) => (
                  <li className="list-group-item px-0" key={task.key}>
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div className="d-flex gap-2">
                        <i
                          className={`bi ${task.completed ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'}`}
                          aria-hidden="true"
                        ></i>
                        <div>
                          <div className="fw-semibold">{task.label}</div>
                          {task.description && <div className="text-muted small">{task.description}</div>}
                        </div>
                      </div>

                      {!task.completed && task.actionType === 'link' && task.to && (
                        <Link className="btn btn-sm btn-outline-primary" to={task.to}>
                          {task.actionLabel || 'Complete'}
                        </Link>
                      )}

                      {!task.completed && task.actionType === 'button' && typeof task.onAction === 'function' && (
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={task.onAction}>
                          {task.actionLabel || 'Complete'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
