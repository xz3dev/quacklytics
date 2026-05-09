drop table if exists person_distinct_ids;
drop table if exists sessions;
drop table if exists persons;
drop table if exists events;

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

create table persons
(
    id                  text primary key,
    first_seen          timestamp not null,
    properties          json      not null,
    property_timestamps json      not null
);

create table sessions
(
    id         text primary key,
    person_id  text references persons(id),
    first_seen timestamp not null,
    last_seen  timestamp not null
);
