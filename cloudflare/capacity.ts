/** Free first release: capacity for 100 creators, with guest traffic kept separate.
 * These are new-service limits, not a promise about the shared provider bill.
 */
export const CAPACITY = Object.freeze({
 creators:100,
 ownerPhotoBytes:100_000_000,
 servicePhotoBytes:10_000_000_000,
 uploadingSlots:8,
 imageTransformsPerDay:5_000,
 imageTransformsPerMonth:5_000,
 ownerTransformsPerMonth:150,
 r2WritesPerDay:20_000,
 r2WritesPerMonth:200_000,
 r2ReadsPerDay:1_000_000,
 r2ReadsPerMonth:10_000_000,
 apiRequestsPerDay:1_000_000,
 apiRequestsPerMonth:10_000_000,
 publicReadsPerMinute:600,
 guestWritesPerMinute:60,
 guestWritesPerDay:50_000,
});
