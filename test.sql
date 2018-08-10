select
  id,
  log#>'{0,time}' as u0,
  log#>'{1,time}' as u1,
  log#>'{2,time}' as u2,
  log#>'{3,time}' as u3,
  log#>'{4,time}' as u4,
  log#>'{5,time}' as u5,
  log#>'{6,time}' as u6,
  log#>'{7,time}' as u7,
  log#>'{8,time}' as u8,
  log#>'{9,time}' as u9
  from logs;

CREATE OR REPLACE FUNCTION public.update_time()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.last_update_time = now();
    RETURN NEW;
END;
$function$;

CREATE TRIGGER update_last_time BEFORE UPDATE ON profile FOR EACH ROW EXECUTE PROCEDURE  update_time();

CREATE OR REPLACE VIEW public."response_times" AS
 SELECT logs.id,
    (logs.log #>> '{0,diff}')::float AS u0,
    (logs.log #>> '{1,diff}')::float AS u1,
    (logs.log #>> '{2,diff}')::float AS u2,
    (logs.log #>> '{3,diff}')::float AS u3,
    (logs.log #>> '{4,diff}')::float AS u4,
    (logs.log #>> '{5,diff}')::float AS u5,
    (logs.log #>> '{6,diff}')::float AS u6,
    (logs.log #>> '{7,diff}')::float AS u7,
    (logs.log #>> '{8,diff}')::float AS u8,
    (logs.log #>> '{9,diff}')::float AS u9
   FROM logs;

CREATE OR REPLACE VIEW public."missed_events" AS
 SELECT response_times.id,
    (((((((((
        CASE
            WHEN (response_times.u0 IS NULL) THEN 1
            ELSE 0
        END +
        CASE
            WHEN (response_times.u1 IS NULL) THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (response_times.u2 IS NULL) THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (response_times.u3 IS NULL) THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (response_times.u4 IS NULL) THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (response_times.u5 IS NULL) THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (response_times.u6 IS NULL) THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (response_times.u7 IS NULL) THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (response_times.u8 IS NULL) THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (response_times.u9 IS NULL) THEN 1
            ELSE 0
        END) AS total_missed_events,
    response_times.u0,
    response_times.u1,
    response_times.u2,
    response_times.u3,
    response_times.u4,
    response_times.u5,
    response_times.u6,
    response_times.u7,
    response_times.u8,
    response_times.u9
   FROM response_times
  WHERE ((response_times.u0 IS NULL) OR (response_times.u1 IS NULL) OR (response_times.u2 IS NULL) OR (response_times.u3 IS NULL) OR (response_times.u4 IS NULL) OR (response_times.u5 IS NULL) OR (response_times.u6 IS NULL) OR (response_times.u7 IS NULL) OR (response_times.u8 IS NULL) OR (response_times.u9 IS NULL));

CREATE OR REPLACE VIEW public."avg_times" AS
 SELECT round((avg(response_times.u0))::numeric, 2) AS first,
    round((avg(response_times.u1))::numeric, 2) AS second,
    round((avg(response_times.u2))::numeric, 2) AS third,
    round((avg(response_times.u3))::numeric, 2) AS fourth,
    round((avg(response_times.u4))::numeric, 2) AS fifth,
    round((avg(response_times.u5))::numeric, 2) AS sixth,
    round((avg(response_times.u6))::numeric, 2) AS seventh,
    round((avg(response_times.u7))::numeric, 2) AS eight,
    round((avg(response_times.u8))::numeric, 2) AS ninth,
    round((avg(response_times.u9))::numeric, 2) AS tenth
   FROM response_times;


CREATE OR REPLACE VIEW public."stddev_times" AS
 SELECT round((stddev(response_times.u0))::numeric, 2) AS first,
    round((stddev(response_times.u1))::numeric, 2) AS second,
    round((stddev(response_times.u2))::numeric, 2) AS third,
    round((stddev(response_times.u3))::numeric, 2) AS fourth,
    round((stddev(response_times.u4))::numeric, 2) AS fifth,
    round((stddev(response_times.u5))::numeric, 2) AS sixth,
    round((stddev(response_times.u6))::numeric, 2) AS seventh,
    round((stddev(response_times.u7))::numeric, 2) AS eight,
    round((stddev(response_times.u8))::numeric, 2) AS ninth,
    round((stddev(response_times.u9))::numeric, 2) AS tenth
   FROM response_times;
