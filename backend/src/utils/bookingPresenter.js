const crypto = require('crypto');

const {
  dateForHalt,
  findRouteHalts,
  journeyDetails,
  serviceDateForBoarding,
} = require("./journey");

function generatePnr() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';

  for (let i = 0; i < 8; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    randomPart += chars[randomIndex];
  }
  return `RR${randomPart}`;
}

async function createUniquePnr(tx) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const pnr = generatePnr();
    const existing = await tx.booking.findUnique({ where: { pnr }, select: { id: true } });
    if (!existing) return pnr;
  }
  throw Object.assign(new Error("Could not generate a unique PNR. Please try again."), {
    statusCode: 500,
  });
}

function dateWithTime(date, time) {
  if (!date || !time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setUTCHours(hours, minutes, 0, 0);
  return result.toISOString();
}

function routeDateTimes(travelDate, boardingHalt, destinationHalt) {
  if (!travelDate || !boardingHalt || !destinationHalt) {
    return { startDateTime: null, arrivalDateTime: null };
  }

  const boardingDate = new Date(travelDate);
  if (Number.isNaN(boardingDate.getTime())) {
    return { startDateTime: null, arrivalDateTime: null };
  }

  const serviceDate = serviceDateForBoarding(boardingDate, boardingHalt);
  const startDate = dateForHalt(serviceDate, boardingHalt, "departureDay", "arrivalDay");
  const arrivalDate = dateForHalt(
    serviceDate,
    destinationHalt,
    "arrivalDay",
    "departureDay"
  );

  return {
    startDateTime: dateWithTime(startDate, boardingHalt.departureTime || boardingHalt.arrivalTime),
    arrivalDateTime: dateWithTime(
      arrivalDate,
      destinationHalt.arrivalTime || destinationHalt.departureTime
    ),
  };
}

function journeyFields(booking, route, coachType) {
  if (!route) {
    return {
      distance: null,
      baseRouteFare: null,
      routeFare: null,
      durationMinutes: null,
      durationText: null,
      startDateTime: null,
      arrivalDateTime: null,
    };
  }

  const details = journeyDetails(route.boardingHalt, route.destinationHalt, coachType);
  return {
    ...details,
    ...routeDateTimes(booking.travelDate, route.boardingHalt, route.destinationHalt),
  };
}

function presentBooking(booking) {
  const route = booking.train?.halts
    ? findRouteHalts(booking.train.halts, booking.boarding, booking.destination)
    : null;
  const fields = journeyFields(booking, route, booking.coach?.type);

  return {
    ...booking,
    train: booking.train
      ? {
          name: booking.train.name,
          number: booking.train.number,
        }
      : booking.train,
    ...fields,
    stripeId: booking.payment?.stripePaymentId || null,
  };
}

module.exports = {
  createUniquePnr,
  journeyFields,
  presentBooking,
};
