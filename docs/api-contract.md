# API Contracts

## Event

### API Contract

| Method | Path        | Body                                                                      | Success                               | Error                                                                                           |
| ------ | ----------- | ------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| POST   | /events     | {title, description, category, durationMins, language}                    | 201 + Created event + Location header | 400 Invalid body, 409 duplicate title                                                           |
| GET    | /events     | None                                                                      | 200                                   | 400 Bad request for invalid filter params, 401 Unauthorised, 403 Forbidden, 504 Gateway timeout |
| GET    | /events/:id | None                                                                      | 200                                   | 400 Bad request for invalid id, 404 Not found, 401 Unauthorised, 403 Forbidden                  |
| PATCH  | /events/:id | Any combination of {title, description, category, durationMins, language} | 200 ok                                | 400 Bad request for invalid body, 404 Not found, 409 Possible Conflict                          |
| DELETE | /events/:id | None                                                                      | 204 No Content                        | 400 Bad request for invalid id format, 404 Not found, 409 Possible Conflict                     |

### Event object

| Field Name   | Type   | Required?                        | Limits                                      |
| ------------ | ------ | -------------------------------- | ------------------------------------------- |
| id           | uuid   | No (auto created on server side) | None                                        |
| title        | string | yes                              | None                                        |
| description  | string | no                               | None                                        |
| category     | string | yes                              | Fetched from category table not random text |
| durationMins | number | yes                              | A positive integer                          |
| language     | strign | yes                              | ISO language code                           |

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
