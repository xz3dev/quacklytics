create table events
(
    id          uuid primary key,
    timestamp   timestamp not null,
    event_type  text      not null,
    distinct_id text      not null,
    properties  json
);
