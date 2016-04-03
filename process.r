#!/usr/bin/env Rscript

income <- read.csv('income_by_age_by_year.csv')

if (exists('out')) { remove(out) }

for (.year in unique(income$year)) {
  .income <- income[income$year == .year,]
  .spline <- spline(.income$age, .income$income, xmin = 20, xmax = 60, n = 41)
  .df <- data.frame(year = .year, age = .spline$x, income = round(.spline$y))

  if (exists('out')) {
    out <- rbind(out, .df)
  } else {
    out <- .df
  }
}

write.csv(out, 'data.csv', row.names = FALSE)