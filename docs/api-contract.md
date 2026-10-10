# API Contracts

## Event

### API Contract

| Method | Path        | Body                                                                      | Success                               | Error                                                                                    |
| ------ | ----------- | ------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| POST   | api/events     | {title, description, category, durationMins, language}                    | 201 + Created event + Location header | 400 Invalid body, 409 duplicate title                                                    |
| GET    | api/events     | None                                                                      | 200                                   | 400 Bad request for invalid filter params                                                |
| GET    | api/events/:id | None                                                                      | 200 + Full event object               | 400 Bad request for invalid id, 404 Not found                                            |
| PATCH  | api/events/:id | Any combination of {title, description, category, durationMins, language} | 200 + Full event object               | 400 Bad request for invalid body, 404 Not found, 409 title already used by another event |
| DELETE | api/events/:id | None                                                                      | 204 No Content                        | 400 Bad request for invalid id format, 404 Not found                                     |

### GET List response shape

```javascript
{
  data: Event[],
  pagination: {
    limit,
    offset,
    total
  }
}
```

### Event object

| Field Name   | Type   | Required?                        | Limits                                      |
| ------------ | ------ | -------------------------------- | ------------------------------------------- |
| id           | uuid   | No (auto created on server side) | None                                        |
| title        | string | yes                              | None                                        |
| description  | string | yes                              | None                                        |
| category     | string | yes                              | Fetched from category table not random text |
| durationMins | number | yes                              | A positive integer                          |
| language     | string | yes                              | ISO language code                           |

#### Fetched from category table not random text

```javascript
concert | comedy | theatre | sports | movie;
```

### Error shape

```javascript
{
  error: {
    (code, message, details, requestId);
  }
}
```

### List rules

pagination: limit, offset
filters: search by title, select category, durationMins, default sort by title
