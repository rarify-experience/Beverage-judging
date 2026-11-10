// Attendance and login activation are never prerequisites for flight release.
export function releaseReadiness(flightId,setup){
  const hasWines=(setup.flightWines||[]).some(w=>w.flight_id===flightId);
  const hasPanels=(setup.flightPanels||[]).some(p=>p.flight_id===flightId);
  const missing=[];
  if(!hasWines)missing.push('Add wines to this flight.');
  if(!hasPanels)missing.push('Assign at least one panel to this flight.');
  return {ready:hasWines&&hasPanels,reason:missing.join(' ')};
}
