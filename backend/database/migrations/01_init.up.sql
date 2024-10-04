create table events
(
    id         uuid primary key,
    timestamp  timestamp,
    event_type text,
    user_id    text,
    properties json
);
