drop table if exists sessions;
drop table if exists persons;
drop table if exists events;

create table events
(
    id          uuid primary key,
    timestamp   timestamp not null,
    event_type  text      not null,
    distinct_id text      not null,
    properties  json
);

create table persons
(
    id         uuid primary key,
    first_seen timestamp,
    properties json
);

create table person_distinct_ids
(
    person_id uuid references persons(id),
    distinct_id text not null,
    primary key (person_id, distinct_id)
);
