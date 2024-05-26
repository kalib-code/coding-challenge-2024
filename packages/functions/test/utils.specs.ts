// leakyBucket algorithm
// should return canSend true and correct remainingCapacity when segments can be sent
// can should return false if exceeded the BUCKET_CAPACITY
// should be able to send segments based on the leak rate
// should be able to send segments in chunks
// should handle rate limit exceeded by delaying retry
// should handle if segments is 0

//calculateSMS
// handle if empty message
// corretly identify the encoding
// correctly calculate the number of segments
// correctly calculate the number of segments for each encoding 160, 70
// correctly split the message into parts and correctly encode the parts
// correctly handle mixed encoding
