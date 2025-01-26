
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
