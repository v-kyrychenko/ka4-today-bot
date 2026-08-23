create table if not exists workout_log_entry (
    id bigserial primary key,
    session_id bigint not null references workout_log_session(id),
    dict_exercise_id bigint references dict_exercise(id),
    raw_description text not null,
    reps integer,
    sets integer,
    weight numeric(5, 1),
    created_at timestamp not null
);

create index if not exists idx_workout_log_entry_session_id
    on workout_log_entry (session_id);

create index if not exists idx_workout_log_entry_dict_exercise_id
    on workout_log_entry (dict_exercise_id);
