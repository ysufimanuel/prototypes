function sameChurch(requester, target) {
  const requesterChurchId = requester?.churchId;
  const targetChurchId = target?.churchId;

  return Boolean(
    requesterChurchId &&
    targetChurchId &&
    requesterChurchId === targetChurchId
  );
}

module.exports = {
  sameChurch,
};
