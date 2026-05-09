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
