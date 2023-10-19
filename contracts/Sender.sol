// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./CCIPBase.sol";

contract Sender is CCIPBase {
    using SafeERC20 for IERC20;

    // Custom errors to provide more descriptive revert messages.
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees); // Used to make sure contract has enough balance to cover the fees.
    error NothingToWithdraw(); // Used when trying to withdraw Ether but there's nothing to withdraw.
    error FailedToWithdraw(address owner, uint256 value); // Used when the withdrawal of Ether fails.
    error DestinationNotWhitelisted(uint64 chainSelector, address receiver); // Used when the destination chain and receiver have not been whitelisted by the contract owner.

    // Event emitted when a message is sent to another chain.
    event MessageSent(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        uint64 indexed destinationChainSelector, // The chain selector of the destination chain.
        address receiver, // The address of the receiver on the destination chain.
        bytes data, // The data being sent.
        address token, // The token address that was transferred.
        uint256 tokenAmount, // The token amount that was transferred.
        address feeToken, // the token address used to pay CCIP fees.
        uint256 fees // The fees paid for sending the message.
    );

    // Event emitted when gasLimit is changed
    event GasLimitChanged(uint _old, uint _new);
    // Event emitted when strictMode is changed
    event StrictModeChanged(bool _old, bool _new);

    // Mapping to keep track of whitelisted destination chain.
    mapping(uint64 => mapping(address => bool)) public whitelistedDestination;

    uint public fixedGasLimit = 200_000;
    bool public strictMode = false;

    constructor(address _router, address _link) CCIPBase(_router, _link) { }

    /// @dev Modifier that checks if the chain with the given destinationChainSelector and receiver are whitelisted.
    /// @param _chainSelector The selector of the destination chain.
    /// @param _receiver The address for the receiver
    modifier onlyWhitelistedDestination(uint64 _chainSelector, address _receiver) {
        if (!whitelistedDestination[_chainSelector][_receiver])
            revert DestinationNotWhitelisted(_chainSelector, _receiver);
        _;
    }

    /// @dev Whitelists a receiver in a destination chain.
    /// @notice This function can only be called by the owner.
    /// @param _chainSelector the selector of the destination chain
    /// @param _receiver The address of the destination receiver to be whitelisted.
    function whitelistDestination(uint64 _chainSelector, address _receiver) external onlyOwner {
        whitelistedDestination[_chainSelector][_receiver] = true;
    }

    /// @dev Denylists a receiver in a destination chain.
    /// @notice This function can only be called by the owner.
    /// @param _chainSelector The selector of the destination chain to be denylisted.
    /// @param _receiver The address of the destination receiver to be denied.
    function denylistDestination(uint64 _chainSelector, address _receiver) external onlyOwner {
        whitelistedDestination[_chainSelector][_receiver] = false;
    }

    /// @notice Sends data and transfer tokens to receiver on the destination chain.
    /// @notice Pay for fees in LINK.
    /// @dev Assumes your contract has sufficient LINK to pay for CCIP fees.
    /// @param _chainSelector The identifier (aka selector) for the destination blockchain.
    /// @param _receiver The address of the recipient on the destination blockchain.
    /// @param _payload The bytes data to be sent.
    /// @param _token token address.
    /// @param _amount token amount.
    /// @return messageId The ID of the CCIP message that was sent.
    function sendMessagePayLINK(
        uint64 _chainSelector,
        address _receiver,
        bytes calldata _payload,
        address _token,
        uint256 _amount
    )
        external
        nonReentrant
        onlyWhitelistedDestination(_chainSelector, _receiver)
        returns (bytes32 messageId)
    {
        // Create an EVM2AnyMessage struct in memory with necessary information for sending a cross-chain message
        // address(linkToken) means fees are paid in LINK
        Client.EVM2AnyMessage memory evm2AnyMessage = _buildCCIPMessage(
            _receiver,
            _payload,
            _token,
            _amount,
            address(linkToken)
        );

        // Initialize a router client instance to interact with cross-chain router
        IRouterClient router = IRouterClient(this.getRouter());

        // Get the fee required to send the CCIP message
        uint256 fees = router.getFee(_chainSelector, evm2AnyMessage);

        if (fees > linkToken.balanceOf(msg.sender))
            revert NotEnoughBalance(linkToken.balanceOf(msg.sender), fees);

        // Charge the sender
        linkToken.safeTransferFrom(msg.sender, address(this), fees);
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // approve the Router to transfer LINK tokens on contract's behalf. It will spend the fees in LINK
        linkToken.safeApprove(address(router), fees);

        // approve the Router to spend tokens on contract's behalf. It will spend the amount of the given token
        IERC20(_token).safeApprove(address(router), _amount);

        // Send the message through the router and store the returned message ID
        messageId = router.ccipSend(_chainSelector, evm2AnyMessage);

        // Emit an event with message details
        emit MessageSent(
            messageId,
            _chainSelector,
            _receiver,
            _payload,
            _token,
            _amount,
            address(linkToken),
            fees
        );

        // Return the message ID
        return messageId;
    }

    /// @notice Sends data and transfer tokens to receiver on the destination chain.
    /// @notice Pay for fees in native gas.
    /// @dev Assumes your contract has sufficient native gas like ETH on Ethereum or MATIC on Polygon.
    /// @param _chainSelector The identifier (aka selector) for the destination blockchain.
    /// @param _receiver The address of the recipient on the destination blockchain.
    /// @param _payload The bytes data to be sent.
    /// @param _token token address.
    /// @param _amount token amount.
    /// @return messageId The ID of the CCIP message that was sent.
    function sendMessagePayNative(
        uint64 _chainSelector,
        address _receiver,
        bytes calldata _payload,
        address _token,
        uint256 _amount
    )
        external payable
        nonReentrant
        onlyWhitelistedDestination(_chainSelector, _receiver)
        returns (bytes32 messageId)
    {
        // Create an EVM2AnyMessage struct in memory with necessary information for sending a cross-chain message
        // address(0) means fees are paid in native gas
        Client.EVM2AnyMessage memory evm2AnyMessage = _buildCCIPMessage(
            _receiver,
            _payload,
            _token,
            _amount,
            address(0)
        );

        // Initialize a router client instance to interact with cross-chain router
        IRouterClient router = IRouterClient(this.getRouter());

        // Get the fee required to send the CCIP message
        uint256 fees = router.getFee(_chainSelector, evm2AnyMessage);

        if (fees > msg.value)
            revert NotEnoughBalance(msg.value, fees);

        // approve the Router to spend tokens on contract's behalf. It will spend the amount of the given token
        IERC20(_token).safeApprove(address(router), _amount);

        // Send the message through the router and store the returned message ID
        messageId = router.ccipSend{value: fees}(
            _chainSelector,
            evm2AnyMessage
        );

        // Emit an event with message details
        emit MessageSent(
            messageId,
            _chainSelector,
            _receiver,
            _payload,
            _token,
            _amount,
            address(0),
            fees
        );

        // Return the message ID
        return messageId;
    }

    /// @notice Construct a CCIP message.
    /// @dev This function will create an EVM2AnyMessage struct with all the necessary information for programmable tokens transfer.
    /// @param _receiver The address of the receiver.
    /// @param _payload The bytes data to be sent.
    /// @param _token The token to be transferred.
    /// @param _amount The amount of the token to be transferred.
    /// @param _feeTokenAddress The address of the token used for fees. Set address(0) for native gas.
    /// @return Client.EVM2AnyMessage Returns an EVM2AnyMessage struct which contains information for sending a CCIP message.
    function _buildCCIPMessage(
        address _receiver,
        bytes calldata _payload,
        address _token,
        uint256 _amount,
        address _feeTokenAddress
    ) internal view returns (Client.EVM2AnyMessage memory) {
        // Set the token amounts
        Client.EVMTokenAmount[]
            memory tokenAmounts = new Client.EVMTokenAmount[](1);
        Client.EVMTokenAmount memory tokenAmount = Client.EVMTokenAmount({
            token: _token,
            amount: _amount
        });
        tokenAmounts[0] = tokenAmount;
        // Create an EVM2AnyMessage struct in memory with necessary information for sending a cross-chain message
        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(_receiver), // ABI-encoded receiver address
            data: _payload, // ABI-encoded data
            tokenAmounts: tokenAmounts, // The amount and type of token being transferred
            extraArgs: Client._argsToBytes(
                // Additional arguments, setting gas limit and non-strict sequencing mode
                Client.EVMExtraArgsV1({gasLimit: fixedGasLimit, strict: strictMode})
            ),
            // Set the feeToken to a feeTokenAddress, indicating specific asset will be used for fees
            feeToken: _feeTokenAddress
        });
        return evm2AnyMessage;
    }

    /// @notice Fallback function to allow the contract to receive Ether.
    /// @dev This function has no function body, making it a default function for receiving Ether.
    /// It is automatically called when Ether is sent to the contract without any data.
    receive() external payable {}

    /// @notice Allows the contract owner to withdraw the entire balance of Ether from the contract.
    /// @dev This function reverts if there are no funds to withdraw or if the transfer fails.
    /// It should only be callable by the owner of the contract.
    function withdraw() external onlyOwner {
        // Retrieve the balance of this contract
        uint256 amount = address(this).balance;

        // Revert if there is nothing to withdraw
        if (amount == 0) revert NothingToWithdraw();

        // Attempt to send the funds, capturing the success status and discarding any return data
        (bool sent, ) = msg.sender.call{value: amount}("");

        // Revert if the send failed, with information about the attempted transfer
        if (!sent) revert FailedToWithdraw(msg.sender, amount);
    }

    /// @notice Allows the owner of the contract to withdraw all tokens of a specific ERC20 token.
    /// @dev This function reverts with a 'NothingToWithdraw' error if there are no tokens to withdraw.
    /// @param _token The contract address of the ERC20 token to be withdrawn.
    function withdrawToken(address _token) external onlyOwner {
        // Retrieve the balance of this contract
        uint256 amount = IERC20(_token).balanceOf(address(this));

        // Revert if there is nothing to withdraw
        if (amount == 0) revert NothingToWithdraw();

        IERC20(_token).safeTransfer(msg.sender, amount);
    }

    /**
     * @notice Returns the fee for a sending CCIP message.
     * @param _chainSelector The identifier (aka selector) for the destination blockchain.
     * @param _receiver The address of the recipient on the destination blockchain.
     * @param _payload The bytes data to be sent.
     * @param _token token address.
     * @param _amount token amount.
     * @param _paymentToken token to pay the fee.
     * @return fee The amount of the paymentToken to be paid for the CCIP message.
     */
    function feeFor(
        uint64 _chainSelector,
        address _receiver,
        bytes calldata _payload,
        address _token,
        uint256 _amount,
        address _paymentToken
    ) public view returns (uint) {
        Client.EVM2AnyMessage memory evm2AnyMessage = _buildCCIPMessage(
            _receiver,
            _payload,
            _token,
            _amount,
            _paymentToken
        );

        // Initialize a router client instance to interact with cross-chain router
        IRouterClient router = IRouterClient(this.getRouter());

        // Get the fee required to send the CCIP message
        return router.getFee(_chainSelector, evm2AnyMessage);
    }

    /// @dev Change the fixedGastLimit value for the router fee
    /// @notice This function can only be called by the owner.
    /// @param _fixedGasLimit The new value for the gasLimit
    function setFixedGasLimit(uint _fixedGasLimit) external onlyOwner {
        emit GasLimitChanged(fixedGasLimit, _fixedGasLimit);

        fixedGasLimit = _fixedGasLimit;
    }

    /// @dev Change StrictMode to the specific value
    /// @notice This function can only be called by the owner.
    /// @param _strictMode The bool value for the strict mode.
    function setStrictMode(bool _strictMode) external onlyOwner {
        emit StrictModeChanged(strictMode, _strictMode);

        strictMode = _strictMode;
    }

    // CCIPReceiver inheritance

  function _ccipReceive(Client.Any2EVMMessage memory) internal pure override {
      revert("Should not be called");
  }
}
