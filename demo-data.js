window.LW_DEMO_DATA = {
  periods: {
    '4w': {
      label: 'Last 4 weeks',
      scopes: {
        orono: {
          fte: 63, capacity: 69, netAdds: 2, leads: 19, tours: 11, toursCompleted: 9, enrollments: 4,
          charges: 92300, payments: 90450, discounts: 2150, subsidies: 7200, pastDue: 5100,
          studentHours: 10480, staffHours: 1776,
          enrollmentSeries: [58, 59, 59.5, 60, 60.5, 61.5, 62, 63],
          forecastSeries: [63, 64, 65, 66],
          collectionsSeries: [21200, 22350, 22600, 24300],
          leadSources: { Website: 8, Referral: 5, Google: 4, Other: 2 },
          classrooms: [
            { name: 'Toddler', fte: 12, capacity: 14, futureStarts: 1 },
            { name: 'Children’s House A', fte: 17, capacity: 18, futureStarts: 1 },
            { name: 'Children’s House B', fte: 16, capacity: 18, futureStarts: 0 },
            { name: 'Primary / Other', fte: 18, capacity: 19, futureStarts: 1 }
          ],
          attention: [
            { level: 'watch', title: 'One classroom is nearing effective capacity', detail: 'Children’s House A is at 94% FTE occupancy.' },
            { level: 'good', title: 'Collections are above target', detail: '98.0% of net charges collected during the period.' }
          ]
        },
        alpine: {
          fte: 79, capacity: 89, netAdds: 4, leads: 29, tours: 16, toursCompleted: 13, enrollments: 7,
          charges: 115100, payments: 111650, discounts: 2650, subsidies: 5700, pastDue: 9100,
          studentHours: 12890, staffHours: 2432,
          enrollmentSeries: [72, 73, 74, 75, 75.5, 76.5, 77.5, 79],
          forecastSeries: [79, 81, 82, 84],
          collectionsSeries: [26500, 27650, 28100, 29400],
          leadSources: { Website: 11, Referral: 8, Google: 7, Other: 3 },
          classrooms: [
            { name: 'Infant', fte: 11, capacity: 14, futureStarts: 1 },
            { name: 'Toddler', fte: 16, capacity: 18, futureStarts: 2 },
            { name: 'Preschool A', fte: 20, capacity: 22, futureStarts: 1 },
            { name: 'Preschool B', fte: 18, capacity: 21, futureStarts: 1 },
            { name: 'Pre-K / Other', fte: 14, capacity: 14, futureStarts: 0 }
          ],
          attention: [
            { level: 'watch', title: 'Occupancy remains below 90%', detail: '88.8% FTE occupancy; current pipeline supports improvement.' },
            { level: 'good', title: 'Admissions momentum is strong', detail: '7 new enrollments from 29 leads in the last four weeks.' },
            { level: 'watch', title: 'Staff leverage trails Orono', detail: '5.3x student hours per staff hour vs. 5.9x at Orono.' }
          ]
        }
      }
    },
    '8w': {
      label: 'Last 8 weeks',
      scopes: {
        orono: {
          fte: 63, capacity: 69, netAdds: 4, leads: 35, tours: 20, toursCompleted: 17, enrollments: 8,
          charges: 181900, payments: 176500, discounts: 4200, subsidies: 13900, pastDue: 5100,
          studentHours: 20700, staffHours: 3538,
          enrollmentSeries: [56, 57, 57.5, 58, 58.5, 59, 59.5, 60, 60.5, 61, 61.5, 62, 62, 62.5, 63, 63],
          forecastSeries: [63, 64, 65, 66],
          collectionsSeries: [20400, 21800, 21700, 22050, 21200, 22350, 22600, 24300],
          leadSources: { Website: 15, Referral: 9, Google: 7, Other: 4 },
          classrooms: [
            { name: 'Toddler', fte: 12, capacity: 14, futureStarts: 1 },
            { name: 'Children’s House A', fte: 17, capacity: 18, futureStarts: 1 },
            { name: 'Children’s House B', fte: 16, capacity: 18, futureStarts: 0 },
            { name: 'Primary / Other', fte: 18, capacity: 19, futureStarts: 1 }
          ],
          attention: [
            { level: 'watch', title: 'One classroom is nearing effective capacity', detail: 'Children’s House A is at 94% FTE occupancy.' },
            { level: 'good', title: 'Enrollment has added four FTEs', detail: 'FTE enrollment increased from roughly 59 to 63.' }
          ]
        },
        alpine: {
          fte: 79, capacity: 89, netAdds: 7, leads: 54, tours: 31, toursCompleted: 25, enrollments: 13,
          charges: 226200, payments: 218800, discounts: 5100, subsidies: 11100, pastDue: 9100,
          studentHours: 25300, staffHours: 4802,
          enrollmentSeries: [68, 69, 70, 70.5, 71, 72, 73, 74, 75, 75, 76, 76.5, 77.5, 78, 78.5, 79],
          forecastSeries: [79, 81, 82, 84],
          collectionsSeries: [24900, 25800, 26900, 27550, 26500, 27650, 28100, 29400],
          leadSources: { Website: 21, Referral: 14, Google: 13, Other: 6 },
          classrooms: [
            { name: 'Infant', fte: 11, capacity: 14, futureStarts: 1 },
            { name: 'Toddler', fte: 16, capacity: 18, futureStarts: 2 },
            { name: 'Preschool A', fte: 20, capacity: 22, futureStarts: 1 },
            { name: 'Preschool B', fte: 18, capacity: 21, futureStarts: 1 },
            { name: 'Pre-K / Other', fte: 14, capacity: 14, futureStarts: 0 }
          ],
          attention: [
            { level: 'watch', title: 'Occupancy remains below 90%', detail: '88.8% FTE occupancy despite strong recent net adds.' },
            { level: 'good', title: 'Pipeline conversion is healthy', detail: '13 enrollments from 54 leads over eight weeks.' }
          ]
        }
      }
    },
    'mtd': {
      label: 'Month to date',
      scopes: {
        orono: {
          fte: 63, capacity: 69, netAdds: 1, leads: 11, tours: 6, toursCompleted: 5, enrollments: 2,
          charges: 46800, payments: 45950, discounts: 1050, subsidies: 3500, pastDue: 5100,
          studentHours: 5280, staffHours: 892,
          enrollmentSeries: [61.5, 62, 62.3, 63], forecastSeries: [63, 64, 65, 66], collectionsSeries: [22350, 23600],
          leadSources: { Website: 5, Referral: 3, Google: 2, Other: 1 },
          classrooms: [
            { name: 'Toddler', fte: 12, capacity: 14, futureStarts: 1 },
            { name: 'Children’s House A', fte: 17, capacity: 18, futureStarts: 1 },
            { name: 'Children’s House B', fte: 16, capacity: 18, futureStarts: 0 },
            { name: 'Primary / Other', fte: 18, capacity: 19, futureStarts: 1 }
          ],
          attention: [{ level: 'watch', title: 'One classroom is nearing effective capacity', detail: 'Children’s House A is at 94% FTE occupancy.' }]
        },
        alpine: {
          fte: 79, capacity: 89, netAdds: 2, leads: 16, tours: 9, toursCompleted: 7, enrollments: 4,
          charges: 58200, payments: 56250, discounts: 1350, subsidies: 2900, pastDue: 9100,
          studentHours: 6510, staffHours: 1223,
          enrollmentSeries: [76.5, 77.5, 78, 79], forecastSeries: [79, 81, 82, 84], collectionsSeries: [27650, 28600],
          leadSources: { Website: 6, Referral: 4, Google: 4, Other: 2 },
          classrooms: [
            { name: 'Infant', fte: 11, capacity: 14, futureStarts: 1 },
            { name: 'Toddler', fte: 16, capacity: 18, futureStarts: 2 },
            { name: 'Preschool A', fte: 20, capacity: 22, futureStarts: 1 },
            { name: 'Preschool B', fte: 18, capacity: 21, futureStarts: 1 },
            { name: 'Pre-K / Other', fte: 14, capacity: 14, futureStarts: 0 }
          ],
          attention: [{ level: 'good', title: 'Admissions momentum is strong', detail: '4 new enrollments month to date.' }]
        }
      }
    }
  }
};
