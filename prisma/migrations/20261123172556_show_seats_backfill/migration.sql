INSERT INTO
  show_seats (show_id, seat_id)
SELECT
  s.id,
  st.id
FROM
  shows s
  JOIN seats st ON st.screen_id = s.screen_id
ON CONFLICT (show_id, seat_id) DO NOTHING;
