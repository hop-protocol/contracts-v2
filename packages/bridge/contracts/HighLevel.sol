// 


contract HopStaking {
    // generically enable staking of HOP, slashing, and governance resolution

    // Uses: bonder registry, capital call staking, user staking, network staking

    // Central staking contract or generic base contract?
    //  - generic base allows more felxibility for things like staking rewards and governance participation
    //  - alternatively push all interactions like stake/unstake through periphery contract
}

contract BonderRegistry {
    // Manage the list of active bonders
    // Manage capital calls
    // Bonders register the amount of an asset they will bond
    // Deactivation has a cool down
    // Only specific assets available for rewarded capital calls but any asset can be provided JIT
    // manages bonder utilization ratio

    // Should bonders be allowed to bond for multiple assets?
}

contract Bridge {
    // Handle the initiation and completion of transfers
    // Handle batch settlements
    // handle the actual staking of assets and solvancy guarantees

    // multitoken?
}

