// Comprehensive list of car brands available in the market (updated 2026)
export const CAR_BRANDS: string[] = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Bugatti",
  "Buick", "BYD", "Cadillac", "Chevrolet", "Chrysler", "Citroën", "Cupra",
  "Dacia", "Dodge", "DS Automobiles", "Ferrari", "Fiat", "Ford", "Genesis",
  "GMC", "Honda", "Hummer", "Hyundai", "Infiniti", "Isuzu", "Jaguar", "Jeep",
  "Kia", "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus", "Maserati",
  "Mazda", "McLaren", "Mercedes-Benz", "Mercury", "MG", "Mini", "Mitsubishi",
  "Nissan", "Oldsmobile", "Opel", "Peugeot", "Pontiac", "Porsche", "RAM",
  "Renault", "Rivian", "Rolls-Royce", "Seat", "Skoda", "Subaru", "Suzuki",
  "Tesla", "Toyota", "Volkswagen", "Volvo",
];

// Motorcycle brands
export const MOTO_BRANDS: string[] = [
  "Bajaj", "Benelli", "Beta", "BMW Motorrad", "Carabela", "Derbi",
  "Ducati", "Harley-Davidson", "Hero", "Honda", "Husqvarna", "Indian",
  "Italika", "Kawasaki", "KTM", "Kymco", "Lifan", "Moto Guzzi",
  "MV Agusta", "Piaggio", "Royal Enfield", "Suzuki", "Triumph",
  "TVS", "Vento", "Vespa", "Yamaha",
];

const CURRENT_YEAR = new Date().getFullYear();
export const VEHICLE_YEARS: string[] = Array.from({ length: 35 }, (_, i) => String(CURRENT_YEAR - i));
