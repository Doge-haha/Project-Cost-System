package com.xindian.saaspricing.auth;

import java.util.Optional;
import java.util.UUID;

public interface CurrentUserProvider {

    Optional<UUID> currentUserId();
}

