interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
}

export const generateICS = (events: CalendarEvent[]): string => {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeText = (text: string): string => {
    return text.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
  };

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DiabeSure//Appointment Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((event) => {
    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${Date.now()}-${Math.random().toString(36).substr(2, 9)}@diabesure.app`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(event.startTime)}`,
      `DTEND:${formatDate(event.endTime)}`,
      `SUMMARY:${escapeText(event.title)}`,
    );

    if (event.description) {
      icsContent.push(`DESCRIPTION:${escapeText(event.description)}`);
    }

    if (event.location) {
      icsContent.push(`LOCATION:${escapeText(event.location)}`);
    }

    icsContent.push('STATUS:CONFIRMED', 'END:VEVENT');
  });

  icsContent.push('END:VCALENDAR');

  return icsContent.join('\r\n');
};

export const downloadICS = (icsContent: string, filename: string = 'appointments.ics') => {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

export const exportAppointmentToCalendar = (appointment: {
  start_time: string;
  end_time?: string;
  notes?: string;
}) => {
  const startTime = new Date(appointment.start_time);
  const endTime = appointment.end_time 
    ? new Date(appointment.end_time) 
    : new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour if no end time

  const event: CalendarEvent = {
    title: 'Medical Appointment - DiabeSure',
    description: appointment.notes || 'Diabetes management appointment',
    location: 'DiabeSure Health Center',
    startTime,
    endTime,
  };

  const icsContent = generateICS([event]);
  downloadICS(icsContent, `appointment-${startTime.toISOString().split('T')[0]}.ics`);
};

export const exportAllAppointments = (appointments: Array<{
  start_time: string;
  end_time?: string;
  notes?: string;
}>) => {
  const events: CalendarEvent[] = appointments.map(apt => {
    const startTime = new Date(apt.start_time);
    const endTime = apt.end_time 
      ? new Date(apt.end_time) 
      : new Date(startTime.getTime() + 60 * 60 * 1000);

    return {
      title: 'Medical Appointment - DiabeSure',
      description: apt.notes || 'Diabetes management appointment',
      location: 'DiabeSure Health Center',
      startTime,
      endTime,
    };
  });

  const icsContent = generateICS(events);
  downloadICS(icsContent, 'all-appointments.ics');
};
