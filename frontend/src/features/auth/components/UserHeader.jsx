function getProfileFallbackLabel(user, form) {
  const seed = form?.displayName || user?.name || "U";

  return seed.trim().charAt(0).toUpperCase();
}

function UserHeader({
  user,
  form,
  onOpenProfilePage,
  triggerClassName = "",
  ariaLabel = "프로필 페이지 열기",
}) {
  return (
    <button
      type="button"
      onClick={onOpenProfilePage}
      className={`app-header-action-trigger ${triggerClassName}`.trim()}
      aria-label={ariaLabel}
      style={{
        padding: 0,
        cursor: "pointer",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: "18px",
      }}
    >
      {user?.picture ? (
        <img
          src={user.picture}
          alt="프로필 사진"
          width="48"
          height="48"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span>{getProfileFallbackLabel(user, form)}</span>
      )}
    </button>
  );
}

export default UserHeader;
