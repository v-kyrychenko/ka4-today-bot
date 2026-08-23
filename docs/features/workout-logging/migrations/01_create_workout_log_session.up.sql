create table if not exists workout_log_session (
    id bigserial primary key,
    client_id bigint not null references client(id),
    session_day date not null,
    started_at timestamp not null,
    ended_at timestamp,
    end_reason varchar(20)
);

create index if not exists idx_workout_log_session_client_id
    on workout_log_session (client_id);

create unique index if not exists uq_workout_log_session_open_client
    on workout_log_session (client_id)
    where ended_at is null;
