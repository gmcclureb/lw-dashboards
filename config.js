window.LW_CONFIG = {
  app: {
    name: 'Little Wonders',
    subtitle: 'Learning Group',
    defaultScope: 'total',
    defaultPeriod: '4w',
    demoMode: true,
    readOnly: true,
    dataPolicy: 'playground-only'
  },
  schools: {
    orono: {
      id: 'ORONO',
      name: 'Orono Montessori School',
      shortName: 'Orono',
      city: 'Orono, MN',
      effectiveCapacity: 69,
      targets: { occupancy: 0.90, leadToEnrollment: 0.22, collectionRate: 0.97, grossPayrollPctNetBilled: 0.50, staffLeverage: 5.5 }
    },
    alpine: {
      id: 'ALPINE',
      name: 'Alpine Montessori',
      shortName: 'Alpine',
      city: 'Minnesota',
      effectiveCapacity: 89,
      targets: { occupancy: 0.90, leadToEnrollment: 0.22, collectionRate: 0.97, grossPayrollPctNetBilled: 0.50, staffLeverage: 5.5 }
    }
  },
  targets: {
    occupancy: 0.90,
    forecastOccupancy30: 0.92,
    leadToEnrollment: 0.22,
    collectionRate: 0.97,
    grossPayrollPctNetBilled: 0.50,
    staffLeverage: 5.5,
    pastDuePctNetBilled: 0.07
  },
  playground: {
    mode: 'demo',
    readOnly: true,
    proxyBaseUrl: '',
    schoolIds: {
      orono: 'ORONO',
      alpine: 'ALPINE'
    },
    pullCatalog: [
      {
        key: 'crm.leads', label: 'CRM leads & stages', domain: 'Admissions',
        playgroundConcepts: ['Leads', 'stage', 'Assigned Site', 'Guardians', 'Students'],
        status: 'public API documented'
      },
      {
        key: 'crm.bookings', label: 'Tour & meeting bookings', domain: 'Admissions',
        playgroundConcepts: ['bookings', 'meetings', 'saved views'],
        status: 'API surface described'
      },
      {
        key: 'enrollment.rosters', label: 'Students, rosters & classrooms', domain: 'Enrollment',
        playgroundConcepts: ['students', 'guardians', 'rosters', 'programs', 'classrooms'],
        status: 'API surface described'
      },
      {
        key: 'enrollment.capacity', label: 'Capacity & FTE enrollment', domain: 'Enrollment',
        playgroundConcepts: ['capacity', 'FTE enrollment', 'programs', 'classrooms', 'future openings'],
        status: 'reporting/API surface described'
      },
      {
        key: 'enrollment.forecast', label: 'Future enrollment / openings', domain: 'Enrollment',
        playgroundConcepts: ['scheduled starts', 'known departures', 'predictive enrollment', 'future openings'],
        status: 'Playground-native; map exact API fields'
      },
      {
        key: 'attendance.students', label: 'Student attendance', domain: 'Operations',
        playgroundConcepts: ['student check-in', 'student check-out', 'timestamp', 'site'],
        status: 'public API documented'
      },
      {
        key: 'attendance.staff', label: 'Staff attendance & schedules', domain: 'Operations',
        playgroundConcepts: ['staff clock-in', 'staff clock-out', 'breaks', 'scheduled hours', 'PTO'],
        status: 'Playground-native; attendance API documented'
      },
      {
        key: 'payroll.summary', label: 'Payroll runs & gross pay', domain: 'Payroll',
        playgroundConcepts: ['payroll runs', 'gross pay', 'taxes', 'deductions', 'pay date'],
        status: 'Playground-native; custom API endpoint if needed'
      },
      {
        key: 'billing.charges', label: 'Charges', domain: 'Billing',
        playgroundConcepts: ['charges', 'accounting metadata'],
        status: 'API surface described'
      },
      {
        key: 'billing.payments', label: 'Payments', domain: 'Billing',
        playgroundConcepts: ['payments', 'payouts', 'payment type'],
        status: 'API surface described'
      },
      {
        key: 'billing.discounts', label: 'Discounts', domain: 'Billing',
        playgroundConcepts: ['discounts'],
        status: 'API surface described'
      },
      {
        key: 'billing.subsidies', label: 'Subsidies', domain: 'Billing',
        playgroundConcepts: ['subsidy data', 'agency payer', 'reconciliation'],
        status: 'API surface described'
      },
      {
        key: 'billing.aging', label: 'Past-due balances / aging', domain: 'Billing',
        playgroundConcepts: ['overdue balances', 'family balances', 'aging'],
        status: 'Playground-native; custom API endpoint if needed'
      }
    ],
    fieldMappings: {
      schoolId: null,
      leadStage: 'stage',
      assignedSite: 'Assigned Site',
      guardians: 'guardians',
      students: 'students',
      studentName: 'studentName',
      studentBirthday: 'studentBirthday',
      fteEnrollment: null,
      capacity: null,
      scheduledStart: null,
      knownDeparture: null,
      studentCheckIn: null,
      studentCheckOut: null,
      staffClockIn: null,
      staffClockOut: null,
      scheduledHours: null,
      payrollGrossPay: null,
      payrollTaxes: null,
      payrollDeductions: null,
      charges: null,
      payments: null,
      discounts: null,
      subsidies: null,
      overdueBalance: null
    }
  }
};
