// Firma bilgileri tek yerde. Eski siteden alındı (2026-11-14); brief formuyla Hakan Bey'e teyit ettirilecek.
module.exports = {
  ad: 'Kiralık Truss',
  kurulus: 2009,
  stokMetretul: 1000, // "yaklaşık 1000 metretül"
  belgeler: ['TÜV', 'TSE', 'CE'],
  telefon: '+90 212 222 96 95',
  telefonLink: '+902122229695',
  faks: '+90 212 222 58 26',
  eposta: 'info@kiraliktruss.com',
  adres: 'Beysan Sanayi Sitesi, Sinpaş İş Modern, Ambarlı Yakuplu Mah. Fuar Cd. Göçmen Sok. No:1/141',
  ilce: 'Beylikdüzü / İstanbul',
  // Eski sitenin iletişim sayfasındaki Google Maps gömmesinden alındı (2026-11-16): pin "Beysan Sanayi Sitesi",
  // gömme adresindeki !3d (enlem) ve !2d (boylam) değerleri. gomme: eski sitedeki iframe adresinin aynısı.
  harita: {
    lat: 40.9936654,
    lon: 28.6865015,
    gomme: 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12045.773949434812!2d28.6865015!3d40.9936654!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14caa065039b4a77%3A0xcca4021ab7fd1a40!2sBeysan%20Sanayi%20Sitesi!5e0!3m2!1str!2str!4v1701096289742!5m2!1str!2str',
  },
};
