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
