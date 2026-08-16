window.LW_CONFIG = {
  app: {
    name: 'Little Wonders',
    subtitle: 'Learning Group',
    defaultScope: 'total',
    defaultPeriod: '4w',
    demoMode: true,
    readOnly: true
  },
  schools: {
    orono: {
      id: 'ORONO',
      name: 'Orono Montessori School',
      shortName: 'Orono',
      city: 'Orono, MN',
      effectiveCapacity: 69
    },
    alpine: {
      id: 'ALPINE',
      name: 'Alpine Montessori',
      shortName: 'Alpine',
      city: 'Minnesota',
      effectiveCapacity: 89
    }
  },
  targets: {
    occupancy: 0.90,
    leadToEnrollment: 0.22,
    collectionRate: 0.97,
    staffLeverage: 5.5
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
        key: 'crm.leads',
        label: 'CRM leads',
        domain: 'Admissions',
        playgroundConcepts: ['Leads', 'stage', 'Assigned Site', 'Guardians', 'Students'],
        status: 'publicly documented'
      },
      {
        key: 'crm.bookings',
        label: 'Tour & meeting bookings',
        domain: 'Admissions',
        playgroundConcepts: ['bookings', 'meetings', 'saved views'],
        status: 'publicly described'
      },
      {
        key: 'enrollment.rosters',
        label: 'Student rosters',
        domain: 'Enrollment',
        playgroundConcepts: ['rosters', 'students', 'programs', 'classrooms'],
        status: 'API surface described'
      },
      {
        key: 'enrollment.capacity',
        label: 'Capacity & FTE enrollment',
        domain: 'Enrollment',
        playgroundConcepts: ['capacity', 'FTE enrollment', 'programs', 'classrooms'],
        status: 'API/reporting surface described'
      },
      {
        key: 'attendance.students',
        label: 'Student attendance',
        domain: 'Labor',
        playgroundConcepts: ['student check-in', 'student check-out', 'timestamp', 'site'],
        status: 'publicly documented'
      },
      {
        key: 'attendance.staff',
        label: 'Staff attendance',
        domain: 'Labor',
        playgroundConcepts: ['staff clock-in', 'staff clock-out', 'timestamp', 'site'],
        status: 'publicly documented'
      },
      {
        key: 'billing.charges',
        label: 'Charges',
        domain: 'Billing',
        playgroundConcepts: ['charges', 'accounting metadata'],
        status: 'API surface described'
      },
      {
        key: 'billing.payments',
        label: 'Payments',
        domain: 'Billing',
        playgroundConcepts: ['payments', 'payouts', 'payment type'],
        status: 'API surface described'
      },
      {
        key: 'billing.discounts',
        label: 'Discounts',
        domain: 'Billing',
        playgroundConcepts: ['discounts'],
        status: 'API surface described'
      },
      {
        key: 'billing.subsidies',
        label: 'Subsidies',
        domain: 'Billing',
        playgroundConcepts: ['subsidy data', 'agency payer', 'reconciliation'],
        status: 'API surface described'
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
      studentCheckIn: null,
      studentCheckOut: null,
      staffClockIn: null,
      staffClockOut: null,
      charges: null,
      payments: null,
      discounts: null,
      subsidies: null
    }
  }
};
