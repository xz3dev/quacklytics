create table events
(
    id                uuid primary key,
    timestamp         timestamp not null,
    event_type        text      not null,
    session_id        text,
    person_id         text,
    properties        json      not null,
    person_properties json      not null
);
